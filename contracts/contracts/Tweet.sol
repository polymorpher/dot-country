// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./IDC.sol";
/**
    @title Tweet domains service contract for .country (DC -  Dot Country)
    @author John Whitton (github.com/johnwhitton), reviewed and revised by Aaron Li (github.com/polymorpher)
    @notice This service contract allows the rental of domains under .country (”DC”)
    it integrates with the DC (DotCountry Domain Controller) and the ENS system as a whole for persisting of domain registrations.
    It is responsible for holding the revenue from these registrations for the web2 portion of the 
    registration process, with the web3 registration revenue being held by the RegistrarController contract.
    An example would be as follows Alice registers alice.com this calls the Tweet service register function with an amount of 10,000 ONE.
    5000 ONE would be held by the Tweet.sol and the remaining 5000 funds would be sent to the RegistrarController 
    via this contract using the register function.

 */
contract Tweet is Pausable, Ownable {
    uint256 public gracePeriod;
    uint256 public baseRentalPrice;
    address public revenueAccount;
    uint256 public duration;
    IDC     public dc;
    bool public initialized;

    struct InitConfiguration {
        uint256 baseRentalPrice;
        uint256 duration;
        uint256 gracePeriod;

        // 20-bytes block
        address revenueAccount;

        // 20-bytes
        address dc;
    }

    struct NameRecord {
        string url; // this one should be pinned on top
        address renter;
        uint256 rentTime;
        uint256 expirationTime;
        uint256 lastPrice;
        string prev;
        string next;
    }

    mapping(bytes32 => NameRecord) public nameRecords;
    mapping(bytes32 => string[]) public urlsPerRecord; // additional urls per record
    string public lastRented;

    bytes32[] public keys;

    event NameRented(string indexed name, address indexed renter, uint256 price, string url);
    event NameRenewed(string indexed name, address indexed renter, uint256 price, string url);
    event NameReinstated(string indexed name, address indexed renter, uint256 price, address oldRenter);
    event URLUpdated(string indexed name, address indexed renter, string oldUrl, string newUrl);
    event URLAdded(string indexed name, address indexed renter, string url);
    event URLRemoved(string indexed name, address indexed renter, string url, uint256 position);
    event URLCleared(string indexed name, address indexed renter);
    event RevenueAccountChanged(address from, address to);

    constructor(InitConfiguration memory _initConfig) {
        setBaseRentalPrice(_initConfig.baseRentalPrice);
        setDuration(_initConfig.duration);
        setGracePeriod(_initConfig.gracePeriod);

        setRevenueAccount(_initConfig.revenueAccount);
        setDC(_initConfig.dc);
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

    function setDC(address _dc) public onlyOwner {
        dc = IDC(_dc);
    }

    function setDuration(uint256 _duration) public onlyOwner {
        duration = _duration;
    }

    function setGracePeriod(uint256 _gracePeriod) public onlyOwner {
        gracePeriod = _gracePeriod;
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
        bool ensAvailable = dc.available(name);
        return ensAvailable && (record.renter == address(0) || uint256(record.expirationTime) + gracePeriod <= block.timestamp);
    }

    /**
     * @dev `makeCommitment` calls RegistrarController makeCommitment with pre-populated values
     * commitment is just a keccak256 hash
     * @param name The name being registered
     * @param owner The address of the owner of the name being registered
     * @param secret A random secret passed by the client
     */
    function makeCommitment(string memory name, address owner, bytes32 secret) public view returns (bytes32) {
        return dc.makeCommitment(name, owner, duration, secret);
    }

    /**
     * @dev `commitment` calls RegistrarController commitment and is used as a locker to ensure that only one registration for a name occurs
     * @param commitment The commitment calculated by makeCommitment
     */
    function commit(bytes32 commitment) public {
        dc.commit(commitment);
    }

    function getPrice(string memory name) public view returns (uint256) {
        uint256 ensPrice = dc.getENSPrice(name, duration);
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
     # @param owner The owner of the registerd name
     * @param url A URL that can be embedded in a web2 default domain page e.g. a twitter post
     * @param secret A random secret passed by the client
     */
    function register(string calldata name, address owner, string calldata url, bytes32 secret) public payable whenNotPaused {
        require(bytes(name).length <= 128, "DC: name too long");
        require(bytes(url).length <= 1024, "DC: url too long");
        uint256 ensPrice = dc.getENSPrice(name, duration);
        uint256 price = getPrice(name);

        require(price <= msg.value, "DC: insufficient payment");
        require(available(name), "DC: name unavailable");
        dc.register{value: ensPrice}(name, owner, duration, secret);
        uint256 tokenId = uint256(keccak256(bytes(name)));
        NameRecord storage nameRecord = nameRecords[bytes32(tokenId)];
        nameRecord.renter = owner;
        nameRecord.lastPrice = price;
        nameRecord.rentTime = block.timestamp;
        nameRecord.expirationTime = block.timestamp + duration;
        if (bytes(url).length > 0) {
            nameRecord.url = url;
        }
        _updateLinkedListWithNewName(nameRecord, name);
        emit NameRented(name, owner, price, url);

        // Return any excess funds
        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            require(success, "cannot refund excess");
        }
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
        uint256 ensPrice = dc.getENSPrice(name, duration);
        uint256 price = baseRentalPrice + ensPrice;
        require(price <= msg.value, "DC: insufficient payment");

        dc.renew{value: ensPrice}(name, duration);

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
        uint256 expiration = dc.nameExpires(name);
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
        require(!dc.available(name), "DC: cannot reinstate an available name in ENS");
        uint256 expiration = dc.nameExpires(name);
        require(expiration > block.timestamp, "DC: name expired");
        address domainOwner = dc.ownerOf(name);
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

    modifier recordOwnerOnly(string calldata name){
        NameRecord storage r = nameRecords[keccak256(bytes(name))];
        require(dc.ownerOf(name) == msg.sender, "DC: not nameWrapperowner");
        require(r.renter == msg.sender, "DC: not owner");
        require(r.expirationTime > block.timestamp, "DC: expired");
        _;
    }
    function updateURL(string calldata name, string calldata url) public whenNotPaused recordOwnerOnly(name){
        bytes32 key = keccak256(bytes(name));
        require(bytes(url).length <= 1024, "DC: url too long");
        emit URLUpdated(name, msg.sender, nameRecords[key].url, url);
        nameRecords[key].url = url;
    }

    function addURL(string calldata name, string calldata url) public whenNotPaused recordOwnerOnly(name) {
        bytes32 key = keccak256(bytes(name));
        require(urlsPerRecord[key].length < 32, "DC: too many urls");
        urlsPerRecord[key].push(url);
        emit URLAdded(name, msg.sender, url);
    }

    function numUrls(string calldata name) public view returns(uint256) {
        bytes32 key = keccak256(bytes(name));
        return urlsPerRecord[key].length;
    }

    function removeUrl(string calldata name, uint256 pos) public whenNotPaused recordOwnerOnly(name) {
        bytes32 key = keccak256(bytes(name));
        require(pos < urlsPerRecord[key].length, "DC: invalid position");
        string memory url = urlsPerRecord[key][pos];
        // have to keep the order
        for (uint256 i = pos; i < urlsPerRecord[key].length - 1; i++) {
            urlsPerRecord[key][pos] = urlsPerRecord[key][pos + 1];
        }
        urlsPerRecord[key].pop();
        emit URLRemoved(name, msg.sender, url, pos);
    }

    function clearUrls(string calldata name) public whenNotPaused recordOwnerOnly(name){
        bytes32 key = keccak256(bytes(name));
        delete urlsPerRecord[key];
        emit URLCleared(name, msg.sender);
    }

    function getAllUrls(string calldata name) public view returns (string[] memory){
        bytes32 key = keccak256(bytes(name));
        string[] memory ret = new string[](urlsPerRecord[key].length);
        for (uint256 i = 0; i < urlsPerRecord[key].length; i++) {
            ret[i] = urlsPerRecord[key][i];
        }
        return ret;
    }

    function withdraw() external {
        require(msg.sender == owner() || msg.sender == revenueAccount, "DC: must be owner or revenue account");
        (bool success, ) = revenueAccount.call{value: address(this).balance}("");
        require(success, "DC: failed to withdraw");
    }

    receive() external payable{

    }
}
