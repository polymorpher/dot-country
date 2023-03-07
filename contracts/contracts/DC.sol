// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "./IRegistrarController.sol";
import "./INameWrapper.sol";
import "./IBaseRegistrar.sol";

/**
    @title A domain manager contract for .country (DC -  Dot Country)
    @author John Whitton (github.com/johnwhitton), reviewed and revised by Aaron Li (github.com/polymorpher)
    @notice This contract simplifies the rental of domains under .country (”DC”), and serves as an entry point for other services to check ownership and expiration over a domain. Under the hood, the contract works with a customized ENS system deployed by https://github.com/harmony-one/ens-deployer
    Services may charge users for activation and keep their own revenue. Funds received by registration are sent to RegistrarController contract and held there.
 */
contract DC is Pausable, Ownable {
    IRegistrarController public registrarController;
    INameWrapper public nameWrapper;
    IBaseRegistrar public baseRegistrar;
    address public resolver;
    bool public reverseRecord;
    uint32 public fuses;
    uint64 public wrapperExpiry;
    uint256 public duration;

    struct InitConfiguration {
        // 32-bytes
        uint64 wrapperExpiry;
        uint32 fuses;
        address registrarController;
        // 61-bytes
        address nameWrapper;
        address baseRegistrar;
        address resolver;
        bool reverseRecord;

        uint256 duration;
    }

    event NameRented(string indexed name, address indexed renter, uint256 price);
    event NameRenewed(string indexed name, address indexed renter, uint256 price);

    constructor(InitConfiguration memory _initConfig) {
        // setBaseRentalPrice(_initConfig.baseRentalPrice);
        setWrapperExpiry(_initConfig.wrapperExpiry);
        setFuses(_initConfig.fuses);
        setDuration(_initConfig.duration);
        setRegistrarController(_initConfig.registrarController);
        setNameWrapper(_initConfig.nameWrapper);
        setBaseRegistrar(_initConfig.baseRegistrar);
        setResolver(_initConfig.resolver);
        setReverseRecord(_initConfig.reverseRecord);
    }

    function setRegistrarController(address _registrarController) public onlyOwner {
        registrarController = IRegistrarController(_registrarController);
    }

    function setNameWrapper(address _nameWrapper) public onlyOwner {
        nameWrapper = INameWrapper(_nameWrapper);
    }

    function setBaseRegistrar(address _baseRegistrar) public onlyOwner {
        baseRegistrar = IBaseRegistrar(_baseRegistrar);
    }

    function setResolver(address _resolver) public onlyOwner {
        resolver = _resolver;
    }

    function setReverseRecord(bool _reverseRecord) public onlyOwner {
        reverseRecord = _reverseRecord;
    }

    function setFuses(uint32 _fuses) public onlyOwner {
        fuses = _fuses;
    }

    function setWrapperExpiry(uint64 _wrapperExpiry) public onlyOwner {
        wrapperExpiry = _wrapperExpiry;
    }

    function setDuration(uint256 _duration) public onlyOwner {
        duration = _duration;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev `available` calls RegistrarController to check if a name is available
     * @param name The name to be checked being registered
     */
    function available(string memory name) public view returns (bool) {
        return registrarController.available(name);
    }

    /**
     * @dev `makeCommitment` calls RegistrarController makeCommitment with pre-populated values
     * commitment is just a keccak256 hash
     * @param name The name being registered
     * @param owner The address of the owner of the name being registered
     * @param secret A random secret passed by the client
     */
    function makeCommitment(string memory name, address owner, bytes32 secret) public view returns (bytes32) {
        bytes[] memory data;
        return registrarController.makeCommitment(name, owner, duration, secret, resolver, data, reverseRecord, fuses, wrapperExpiry);
    }

    /**
     * @dev `commitment` calls RegistrarController commitment and is used as a locker to ensure that only one registration for a name occurs
     * @param commitment The commitment calculated by makeCommitment
     */
    function commit(bytes32 commitment) public {
        registrarController.commit(commitment);
    }

    /**
     * @dev `getENSPrice` gets the price needed to be paid to ENS which calculated as
     * tRegistrarController.rentPrice (price.base + price.premium)
     * @param name The name being registered
     */
    function getPrice(string memory name) public view returns (uint256) {
        IRegistrarController.Price memory price = registrarController.rentPrice(name, duration);
        return price.base + price.premium;
    }

    /**
     * @dev `register` calls RegistrarController register and is used to register a name
     * this also takes a fee for the web2 registration which is held by DC.sol a check is made to ensure the value sent is sufficient for both fees
     * @param name The name to be registered e.g. for test.country it would be test
     # @param owner The owner of the registerd name
     * @param duration Length of time to register the name
     * @param secret A random secret passed by the client
     */
    function register(string calldata name, address owner, bytes32 secret) public payable whenNotPaused {
        require(bytes(name).length <= 128, "DC: name too long");
        uint256 price = getPrice(name);
        require(price <= msg.value, "DC: insufficient payment");
        require(available(name), "DC: name unavailable");
        _register(name, owner, secret);

        // Return any excess funds
        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            require(success, "DC: cannot refund excess");
        }
    }

    /**
     * @dev `_register` calls RegistrarController register and is used to register a name
     * it is passed a value to cover the costs of the ens registration
     * @param name The name to be registered e.g. for test.country it would be test
     * @param owner The owner address of the name to be registered
     * @param secret A random secret passed by the client
     */
    function _register(string calldata name, address owner, bytes32 secret) internal whenNotPaused {
        uint256 ensPrice = getPrice(name);
        bytes[] memory emptyData;
        registrarController.register{value: ensPrice}(name, owner, duration, secret, resolver, emptyData, reverseRecord, fuses, wrapperExpiry);
    }

    /**
     * @dev `renew` calls RegistrarController renew and is used to renew a name
     * @param name The name to be registered e.g. for test.country it would be test
     */
    function renew(string calldata name) public payable whenNotPaused {
        uint256 price = getPrice(name);
        require(price <= msg.value, "DC: insufficient payment");
        registrarController.renew{value: price}(name);
        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            require(success, "cannot refund excess");
        }
    }

    function nameExpires(string calldata name) public view returns(uint256) {
        bytes32 node = keccak256(bytes(name));
        uint256 tokenId = uint256(node);
        return baseRegistrar.nameExpires(tokenId);
    }

    function ownerOf(string calldata name) public view returns(address) {
        bytes32 node = keccak256(bytes(name));
        uint256 tokenId = uint256(node);
        address baseOwner = baseRegistrar.ownerOf(tokenId);
        if(baseOwner != nameWrapper){
            return baseOwner;
        }
        bytes32 tn = nameWrapper.TLD_NODE();
        bytes32 nh = keccak256(bytes.concat(tn, node));
        return nameWrapper.ownerOf(nh);
    }
}
