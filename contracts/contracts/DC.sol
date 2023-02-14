// SPDX-License-Identifier: CC-BY-NC-4.0

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "./IRegistrarController.sol";
import "./IBaseRegistrar.sol";

/**
    @title A domain manager contract for .country (DC -  Dot Country)
    @author John Whitton (github.com/johnwhitton), reviewed and revised by Aaron Li (github.com/polymorpher)
    @notice This contract allows the rental of domains under .country (”DC”)
    it integrates with the ENSRegistrarController and the ENS system as a whole for persisting of domain registrations.
    It is responsible for holding the revenue from these registrations for the web2 portion of the registration process,
    with the web3 registration revenue being held by the RegistrarController contract.
    An example would be as follows Alice registers alice.com and calls the register function with an amount of 10,000 ONE.
    5000 ONE would be held by the DC contract and the remaining 5000 funds would be sent to the RegistrarController using 
    the register function.

 */
contract DC is Pausable, Ownable {
    uint256 public gracePeriod;
    uint256 public baseRentalPrice;
    address public revenueAccount;
    IRegistrarController public registrarController;
    IBaseRegistrar public baseRegistrar;
    uint256 public duration;
    address public resolver;
    bool public reverseRecord;
    uint32 public fuses;
    uint64 public wrapperExpiry;
    bool public initialized;

    struct InitConfiguration {
        uint256 baseRentalPrice;
        uint256 duration;
        uint256 gracePeriod;

        // 32-bytes block
        address revenueAccount;
        uint64 wrapperExpiry;
        uint32 fuses;

        // 61-bytes
        address registrarController;
        address baseRegistrar;
        address resolver;
        bool reverseRecord;
    }

    struct NameRecord {
        address renter;
        uint256 rentTime;
        uint256 expirationTime;
        uint256 lastPrice;
        string url;
        string prev;
        string next;
    }

    mapping(bytes32 => NameRecord) public nameRecords;
    string public lastRented;

    bytes32[] public keys;

    event NameRented(string indexed name, address indexed renter, uint256 price, string url);
    event NameRenewed(string indexed name, address indexed renter, uint256 price, string url);
    event NameReinstated(string indexed name, address indexed renter, uint256 price, address oldRenter);
    event URLUpdated(string indexed name, address indexed renter, string oldUrl, string newUrl);
    event RevenueAccountChanged(address from, address to);

    constructor(InitConfiguration memory _initConfig) {
        setBaseRentalPrice(_initConfig.baseRentalPrice);
        setDuration(_initConfig.duration);
        setGracePeriod(_initConfig.gracePeriod);

        setRevenueAccount(_initConfig.revenueAccount);
        setWrapperExpiry(_initConfig.wrapperExpiry);
        setFuses(_initConfig.fuses);

        setRegistrarController(_initConfig.registrarController);
        setBaseRegistrar(_initConfig.baseRegistrar);
        setResolver(_initConfig.resolver);
        setReverseRecord(_initConfig.reverseRecord);
    }

    function initialize(string[] calldata _names, NameRecord[] calldata _records) external onlyOwner {
        require(!initialized, "D1DC: already initialized");
        require(_names.length == _records.length, "D1DC: unequal length");
        for (uint256 i = 0; i < _records.length; i++) {
            bytes32 key = keccak256(bytes(_names[i]));
            nameRecords[key] = _records[i];
            keys.push(key);
            if (i >= 1 && bytes(nameRecords[key].prev).length == 0) {
                nameRecords[key].prev = _names[i - 1];
            }
            if (i < _records.length - 1 && bytes(nameRecords[key].next).length == 0) {
                nameRecords[key].next = _names[i + 1];
            }
        }
        lastRented = _names[_names.length - 1];
    }

    function finishInitialization() external onlyOwner {
        initialized = true;
    }

    // admin functions
    function setBaseRentalPrice(uint256 _baseRentalPrice) public onlyOwner {
        baseRentalPrice = _baseRentalPrice;
    }

    function setRevenueAccount(address _revenueAccount) public onlyOwner {
        emit RevenueAccountChanged(revenueAccount, _revenueAccount);
        revenueAccount = _revenueAccount;
    }

    function setRegistrarController(address _registrarController) public onlyOwner {
        registrarController = IRegistrarController(_registrarController);
    }

    function setBaseRegistrar(address _baseRegistrar) public onlyOwner {
        baseRegistrar = IBaseRegistrar(_baseRegistrar);
    }

    function setDuration(uint256 _duration) public onlyOwner {
        duration = _duration;
    }

    function setGracePeriod(uint256 _gracePeriod) public onlyOwner {
        gracePeriod = _gracePeriod;
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


    function numRecords() public view returns (uint256){
        return keys.length;
    }

    function getRecordKeys(uint256 start, uint256 end) public view returns (bytes32[] memory){
        require(end > start, "D1DC: end must be greater than start");
        bytes32[] memory slice = new bytes32[](end - start);
        for (uint256 i = start; i < end; i++) {
            slice[i - start] = keys[i];
        }
        return slice;
    }

    /**
     * @dev `available` calls RegistrarController to check if a name is available
     * @param name The name to be checked being registered
     */
    function available(string memory name) public view returns (bool) {
        NameRecord storage record = nameRecords[keccak256(bytes(name))];
        return registrarController.available(name) && (record.renter == address(0) || uint256(record.expirationTime) + gracePeriod <= block.timestamp);
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
    function getENSPrice(string memory name) public view returns (uint256) {
        IRegistrarController.Price memory price = registrarController.rentPrice(name, duration);
        return price.base + price.premium;
    }

    function getPrice(string memory name) public view returns (uint256) {
        uint256 ensPrice = getENSPrice(name);
        return ensPrice + baseRentalPrice;
    }

    function _updateLinkedListWithNewName(NameRecord storage nameRecord, string memory name) internal {
        nameRecords[keccak256(bytes(lastRented))].next = name;
        nameRecord.prev = lastRented;
        lastRented = name;
        keys.push(keccak256(bytes(name)));
    }

    /**
     * @dev `register` calls RegistrarController register and is used to register a name
     * this also takes a fee for the web2 registration which is held by DC.sol a check is made to ensure the value sent is sufficient for both fees
     * @param name The name to be registered e.g. for test.country it would be test
     * @param url A URL that can be embedded in a web2 default domain page e.g. a twitter post
     * @param secret A random secret passed by the client
     */
    function register(string calldata name, string calldata url, bytes32 secret, address to) public payable whenNotPaused {
        require(bytes(name).length <= 128, "DC: name too long");
        require(bytes(url).length <= 1024, "DC: url too long");
        uint256 price = getPrice(name);
        require(price <= msg.value, "DC: insufficient payment");
        require(available(name), "DC: name unavailable");
        _register(name, to, secret);
        // Update Name Record and send events
        uint256 tokenId = uint256(keccak256(bytes(name)));
        NameRecord storage nameRecord = nameRecords[bytes32(tokenId)];
        nameRecord.renter = to;
        nameRecord.lastPrice = price;
        nameRecord.rentTime = block.timestamp;
        nameRecord.expirationTime = block.timestamp + duration;
        if (bytes(url).length > 0) {
            nameRecord.url = url;
        }
        _updateLinkedListWithNewName(nameRecord, name);
        emit NameRented(name, to, price, url);

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
     * @param secret A random secret passed by the client
     */
    function _register(string calldata name, address owner, bytes32 secret) internal whenNotPaused {
        uint256 ensPrice = getENSPrice(name);
        bytes[] memory emptyData;
        registrarController.register{value: ensPrice}(name, owner, duration, secret, resolver, emptyData, reverseRecord, fuses, wrapperExpiry);
    }

    /**
     * @dev `renew` calls RegistrarController renew and is used to renew a name
     * this also takes a fee for the web2 renewal which is held by DC.sol a check is made to ensure the value sent is sufficient for both fees
     * duration is set at the contract level
     * @param name The name to be registered e.g. for test.country it would be test
     * @param url A URL that can be embedded in a web2 default domain page e.g. a twitter post
     */
    function renew(string calldata name, string calldata url) public payable whenNotPaused {
        require(bytes(name).length <= 128, "DC: name too long");
        require(bytes(url).length <= 1024, "DC: url too long");
        NameRecord storage nameRecord = nameRecords[keccak256(bytes(name))];
        require(nameRecord.renter != address(0), "DC: name is not rented");
        require(nameRecord.expirationTime + gracePeriod >= block.timestamp, "DC: cannot renew after grace period" );
        uint256 ensPrice = getENSPrice(name);
        uint256 price = baseRentalPrice + ensPrice;
        require(price <= msg.value, "DC: insufficient payment");

        registrarController.renew{value: ensPrice}(name, duration);

        nameRecord.lastPrice = price;
        nameRecord.expirationTime += duration;

        if (bytes(url).length > 0) {
            nameRecord.url = url;
        }

        emit NameRenewed(name, nameRecord.renter, price, url);

        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            require(success, "cannot refund excess");
        }
    }

    function getReinstateCost(string calldata name) public view returns (uint256){
        uint256 tokenId = uint256(keccak256(bytes(name)));
        NameRecord storage nameRecord = nameRecords[bytes32(tokenId)];
        uint256 expiration = baseRegistrar.nameExpires(tokenId);
        uint256 chargeableDuration = 0;
        if (nameRecord.expirationTime == 0) {
            chargeableDuration = expiration - block.timestamp;
        }
        if (expiration > nameRecord.expirationTime) {
            chargeableDuration = expiration - nameRecord.expirationTime;
        }
        uint256 charge = (chargeableDuration * 1e18 / duration * baseRentalPrice) / 1e18;
        return charge;
    }

    function reinstate(string calldata name) public payable whenNotPaused {
        uint256 tokenId = uint256(keccak256(bytes(name)));
        NameRecord storage nameRecord = nameRecords[bytes32(tokenId)];
        require(!registrarController.available(name), "DC: cannot reinstate an available name in ENS");
        uint256 expiration = baseRegistrar.nameExpires(tokenId);
        require(expiration > block.timestamp, "DC: name expired");
        address domainOwner = baseRegistrar.ownerOf(tokenId);
        uint256 charge = getReinstateCost(name);

        require(msg.value >= charge, "DC: insufficient payment");
        nameRecord.expirationTime = expiration;
        if(nameRecord.rentTime == 0){
            nameRecord.rentTime = block.timestamp;
        }
        if(nameRecord.renter == address(0)){
            _updateLinkedListWithNewName(nameRecord, name);
        }
        emit NameReinstated(name, domainOwner, charge, nameRecord.renter);
        nameRecord.renter = domainOwner;
        nameRecord.lastPrice = charge;
        uint256 excess = msg.value - charge;
        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            require(success, "cannot refund excess");
        }
    }

    function updateURL(string calldata name, string calldata url) public payable whenNotPaused {
        NameRecord storage r = nameRecords[keccak256(bytes(name))];
        require(r.renter == msg.sender, "DC: not owner");
        require(r.expirationTime > block.timestamp, "DC: expired");
        require(bytes(url).length <= 1024, "DC: url too long");
        emit URLUpdated(name, msg.sender, nameRecords[keccak256(bytes(name))].url, url);
        nameRecords[keccak256(bytes(name))].url = url;
    }

    function withdraw() external {
        require(msg.sender == owner() || msg.sender == revenueAccount, "DC: must be owner or revenue account");
        (bool success, ) = revenueAccount.call{value: address(this).balance}("");
        require(success, "DC: failed to withdraw");
    }

    receive() external payable{

    }
}
