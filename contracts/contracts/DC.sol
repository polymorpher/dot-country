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
    @notice This contract allows the rental of domains under .country (”DC”)
    it integrates with the ENSRegistrarController and the ENS system as a whole for persisting of domain registrations.
    The calling services are responsible for holding the revenue from these registrations for the web2 portion of the 
    registration process, with the web3 registration revenue being held by the RegistrarController contract.
    An example would be as follows Alice registers alice.com this calls the service register function with an amount of 10,000 ONE.
    5000 ONE would be held by the service contract and the remaining 5000 funds would be sent to the RegistrarController 
    via this contract using the register function.

 */
contract DC is Pausable, Ownable {
    IRegistrarController public registrarController;
    INameWrapper public nameWrapper;
    IBaseRegistrar public baseRegistrar;
    address public resolver;
    bool public reverseRecord;
    uint32 public fuses;
    uint64 public wrapperExpiry;
    bool public initialized;

    struct InitConfiguration {

        // 32-bytes block
        uint64 wrapperExpiry;
        uint32 fuses;
        address registrarController;
        // 21-bytes
        address nameWrapper;
        bool reverseRecord;
        // 20-bytes
        address baseRegistrar;
        // 20-bytes
        address resolver;
    }

    event NameRented(string indexed name, address indexed renter, uint256 price, string url);
    event NameRenewed(string indexed name, address indexed renter, uint256 price, string url);
    event NameReinstated(string indexed name, address indexed renter, uint256 price, address oldRenter);

    constructor(InitConfiguration memory _initConfig) {
        // setBaseRentalPrice(_initConfig.baseRentalPrice);
        setWrapperExpiry(_initConfig.wrapperExpiry);
        setFuses(_initConfig.fuses);

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
        // NameRecord storage record = nameRecords[keccak256(bytes(name))];
        // return registrarController.available(name) && (record.renter == address(0) || uint256(record.expirationTime) + gracePeriod <= block.timestamp);
        return registrarController.available(name);
    }

    /**
     * @dev `makeCommitment` calls RegistrarController makeCommitment with pre-populated values
     * commitment is just a keccak256 hash
     * @param name The name being registered
     * @param owner The address of the owner of the name being registered
     * @param secret A random secret passed by the client
     */
    function makeCommitment(string memory name, address owner, uint256 duration, bytes32 secret) public view returns (bytes32) {
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
    function getENSPrice(string memory name, uint256 duration) public view returns (uint256) {
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
    function register(string calldata name, address owner, uint256 duration, bytes32 secret) public payable whenNotPaused {
        require(bytes(name).length <= 128, "DC: name too long");
        uint256 price = getENSPrice(name, duration);
        require(price <= msg.value, "DC: insufficient payment");
        require(available(name), "DC: name unavailable");
        _register(name, owner, duration, secret);

        // Return any excess funds
        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            require(success, "cannot refund excess");
        }
    }

    /**
     * @dev `_register` calls RegistrarController register and is used to register a name
     * it is passed a value to cover the costs of the ens registration
     * @param name The name to be registered e.g. for test.country it would be test
     * @param owner The owner address of the name to be registered
     * @param duration Length of time to register the name
     * @param secret A random secret passed by the client
     */
    function _register(string calldata name, address owner, uint256 duration, bytes32 secret) internal whenNotPaused {
        uint256 ensPrice = getENSPrice(name, duration);
        bytes[] memory emptyData;
        registrarController.register{value: ensPrice}(name, owner, duration, secret, resolver, emptyData, reverseRecord, fuses, wrapperExpiry);
    }

    /**
     * @dev `renew` calls RegistrarController renew and is used to renew a name
     * @param name The name to be registered e.g. for test.country it would be test
     * @param duration Length of time to register the name
     */
    function renew(string calldata name, uint256 duration) public payable whenNotPaused {
        uint256 price = getENSPrice(name, duration);
        require(price <= msg.value, "DC: insufficient payment");
        registrarController.renew{value: price}(name, duration);
        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            require(success, "cannot refund excess");
        }
    }

    function verifyOnwer(string calldata name, address owner) public view returns(bool) {
        bytes32 node = keccak256(bytes(name));
        uint256 tokenId = uint256(node);
        address currentOwner = nameWrapper.ownerOf(tokenId);
        return owner == currentOwner; 
    }

    function nameExpires(string calldata name) public view returns(uint256) {
        bytes32 node = keccak256(bytes(name));
        uint256 tokenId = uint256(node);
        return baseRegistrar.nameExpires(tokenId);
    }

    function ownerOf(string calldata name) public view returns(address) {
        bytes32 node = keccak256(bytes(name));
        uint256 tokenId = uint256(node);
        return nameWrapper.ownerOf(tokenId);
    }

    modifier recordOwnerOnly(string calldata name){
        bytes32 node = keccak256(bytes(name));
        uint256 tokenId = uint256(node);
        require(nameWrapper.ownerOf(tokenId) == msg.sender, "DC: not nameWrapperowner");
        _;
    }

    receive() external payable{

    }
}
