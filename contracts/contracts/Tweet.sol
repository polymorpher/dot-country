// SPDX-License-Identifier: CC-BY-NC-4.0

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./IDC.sol";
/**
    @title Tweet Service (.country)
    @notice The Tweet service allows users to display tweets of their choice in the .country domain they leased. It charges a flatfee for activation of the service
 */
contract Tweet is Pausable, Ownable {
    uint256 public baseRentalPrice;
    address public revenueAccount;
    IDC public dc;
    bool public initialized;

    struct InitConfiguration {
        uint256 baseRentalPrice;
        address revenueAccount;
        address dc;
    }

    mapping(bytes32 => bool) public activated;
    mapping(bytes32 => string[]) public urls; // additional urls per record

    event URLUpdated(string indexed name, address indexed renter, string oldUrl, string newUrl);
    event URLAdded(string indexed name, address indexed renter, string url);
    event URLRemoved(string indexed name, address indexed renter, string url, uint256 position);
    event URLCleared(string indexed name, address indexed renter);
    event RevenueAccountChanged(address from, address to);
    event TweetActivated(string indexed name);

    constructor(InitConfiguration memory _initConfig) {
        setBaseRentalPrice(_initConfig.baseRentalPrice);
        setRevenueAccount(_initConfig.revenueAccount);
        setDC(_initConfig.dc);
    }

    function initializeActivation(string[] calldata _names) external onlyOwner {
        require(!initialized, "Tweet: already initialized");
        for (uint256 i = 0; i < _names.length; i++) {
            bytes32 key = keccak256(bytes(_names[i]));
            activated[key] = true;
        }
    }

    function initializeUrls(string calldata _name, string[] memory _urls) external onlyOwner {
        require(!initialized, "Tweet: already initialized");
        bytes32 key = keccak256(bytes(_name));
        for (uint256 i = 0; i < _urls.length; i++) {
            urls[key].push(_urls[i]);
        }
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

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    modifier onlyRegistered(string memory name) {
        require(dc.ownerOf(name) != address(0), "Tweet: name not registered");
        _;
    }

    function activate(string calldata name) public payable whenNotPaused onlyRegistered(name) {
        require(baseRentalPrice <= msg.value, "Tweet: insufficient payment");
        uint256 tokenId = uint256(keccak256(bytes(name)));
        require(!activated[bytes32(tokenId)], "Tweet: already activated");
        activated[bytes32(tokenId)] = true;
        emit TweetActivated(name);

        // Return any excess funds
        uint256 excess = msg.value - baseRentalPrice;
        if (excess > 0) {
            (bool success,) = msg.sender.call{value : excess}("");
            require(success, "cannot refund excess");
        }
    }

    modifier activeOwnerOnly(string calldata name){
        require(dc.ownerOf(name) == msg.sender, "Tweet: not name owner");
        uint256 tokenId = uint256(keccak256(bytes(name)));
        require(activated[bytes32(tokenId)], "Tweet: not activated");
        require(dc.nameExpires(name) > block.timestamp, "Tweet: name expired");
        _;
    }
    function addURL(string calldata name, string calldata url) public whenNotPaused activeOwnerOnly(name) {
        bytes32 key = keccak256(bytes(name));
        require(urls[key].length < 64, "Tweet: too many urls");
        urls[key].push(url);
        emit URLAdded(name, msg.sender, url);
    }

    function numUrls(string calldata name) public view returns (uint256) {
        bytes32 key = keccak256(bytes(name));
        return urls[key].length;
    }

    function removeUrl(string calldata name, uint256 pos) public whenNotPaused activeOwnerOnly(name) {
        bytes32 key = keccak256(bytes(name));
        require(pos < urls[key].length, "DC: invalid position");
        string memory url = urls[key][pos];
        // have to keep the order
        for (uint256 i = pos; i < urls[key].length - 1; i++) {
            urls[key][pos] = urls[key][pos + 1];
        }
        urls[key].pop();
        emit URLRemoved(name, msg.sender, url, pos);
    }

    function clearUrls(string calldata name) public whenNotPaused activeOwnerOnly(name) {
        bytes32 key = keccak256(bytes(name));
        delete urls[key];
        emit URLCleared(name, msg.sender);
    }

    function getAllUrls(string calldata name) public view returns (string[] memory){
        bytes32 key = keccak256(bytes(name));
        string[] memory ret = new string[](urls[key].length);
        for (uint256 i = 0; i < urls[key].length; i++) {
            ret[i] = urls[key][i];
        }
        return ret;
    }

    function withdraw() external {
        require(msg.sender == owner() || msg.sender == revenueAccount, "DC: must be owner or revenue account");
        (bool success,) = revenueAccount.call{value : address(this).balance}("");
        require(success, "DC: failed to withdraw");
    }
}
