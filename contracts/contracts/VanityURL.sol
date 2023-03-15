// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./IDC.sol";

contract VanityURL is Ownable, Pausable, ReentrancyGuard {
    /// @dev DC contract
    address public dc;

    /// @dev DC TokenId -> Timestamp the name owner was updated
    mapping(bytes32 => uint256) public nameOwnerUpdateAt;

    /// @dev DC TokenId -> Alias Name -> URL
    mapping(bytes32 => mapping(string => string)) public vanityURLs;

    /// @dev DC Token Id -> Alias Name -> Timestamp the URL was updated
    /// @dev Vanity URL is valid only if nameOwnerUpdateAt <= vanityURLUpdatedAt
    mapping(bytes32 => mapping(string => uint256)) public vanityURLUpdatedAt;

    /// @dev Price for the url update
    uint256 public urlUpdatePrice;

    /// @dev Fee withdrawal address
    address public revenueAccount;

    ///////////////////////////////////////////// Contract Upgrade /////////////////////////////////////////////

    /// @dev DC TokenId -> Alias Name -> Content Price
    mapping(bytes32 => mapping(string => uint256)) public vanityURLPrices;

    event NewURLSet(address by, string indexed name, string indexed aliasName, string indexed url, uint256 price);
    event URLDeleted(address by, string indexed name, string indexed aliasName, string indexed url);
    event URLUpdated(
        address by,
        string indexed name,
        string indexed aliasName,
        string oldURL,
        string indexed newURL,
        uint256 price
    );
    event RevenueAccountChanged(address indexed from, address indexed to);

    modifier onlyDCOwner(string memory _name) {
        address dcOwner = IDC(dc).ownerOf(_name);
        require(msg.sender == dcOwner, "VanityURL: only DC owner");
        _;
    }

    constructor(address _dc, uint256 _urlUpdatePrice, address _revenueAccount) {
        require(_dc != address(0), "VanityURL: zero address");
        require(_revenueAccount != address(0), "VanityURL: zero address");

        dc = _dc;
        urlUpdatePrice = _urlUpdatePrice;
        revenueAccount = _revenueAccount;
    }

    function setDCAddress(address _dc) external onlyOwner {
        dc = _dc;
    }

    function setURLUpdatePrice(uint256 _urlUpdatePrice) external onlyOwner {
        urlUpdatePrice = _urlUpdatePrice;
    }

    function setRevenueAccount(address _revenueAccount) public onlyOwner {
        emit RevenueAccountChanged(revenueAccount, _revenueAccount);

        revenueAccount = _revenueAccount;
    }

    // function setNameOwnerUpdateAt(bytes32 _d1dcV2TokenId) external {
    //     address dc = addressRegistry.dc();
    //     require(msg.sender == dc, "VanityURL: only DC");

    //     nameOwnerUpdateAt[_d1dcV2TokenId] = block.timestamp;
    // }

    function setNewURL(
        string calldata _name,
        string calldata _aliasName,
        string calldata _url,
        uint256 _price
    ) external payable nonReentrant whenNotPaused onlyDCOwner(_name) {
        require(bytes(_aliasName).length <= 1024, "VanityURL: alias too long");
        require(bytes(_url).length <= 1024, "VanityURL: url too long");

        require(!checkURLValidity(_name, _aliasName), "VanityURL: url already exists");

        uint256 price = urlUpdatePrice;
        require(price <= msg.value, "VanityURL: insufficient payment");

        // set a new URL
        bytes32 tokenId = keccak256(bytes(_name));
        vanityURLs[tokenId][_aliasName] = _url;
        vanityURLPrices[tokenId][_aliasName] = _price;
        vanityURLUpdatedAt[tokenId][_aliasName] = block.timestamp;

        // returns the exceeded payment
        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            require(success, "cannot refund excess");
        }

        emit NewURLSet(msg.sender, _name, _aliasName, _url, _price);
    }

    function deleteURL(string calldata _name, string calldata _aliasName) external whenNotPaused onlyDCOwner(_name) {
        require(checkURLValidity(_name, _aliasName), "VanityURL: invalid URL");

        bytes32 tokenId = keccak256(bytes(_name));
        string memory url = vanityURLs[tokenId][_aliasName];

        // delete the URL
        vanityURLs[tokenId][_aliasName] = "";
        vanityURLPrices[tokenId][_aliasName] = 0;
        vanityURLUpdatedAt[tokenId][_aliasName] = block.timestamp;

        emit URLDeleted(msg.sender, _name, _aliasName, url);
    }

    function updateURL(
        string calldata _name,
        string calldata _aliasName,
        string calldata _url,
        uint256 _price
    ) external whenNotPaused onlyDCOwner(_name) {
        bytes32 tokenId = keccak256(bytes(_name));

        require(bytes(_url).length <= 1024, "VanityURL: url too long");
        require(checkURLValidity(_name, _aliasName), "VanityURL: invalid URL");

        emit URLUpdated(msg.sender, _name, _aliasName, vanityURLs[tokenId][_aliasName], _url, _price);

        // update the URL
        vanityURLs[tokenId][_aliasName] = _url;
        vanityURLPrices[tokenId][_aliasName] = _price;
        vanityURLUpdatedAt[tokenId][_aliasName] = block.timestamp;
    }

    function getURL(string calldata _name, string calldata _aliasName) external view returns (string memory) {
        bytes32 tokenId = keccak256(bytes(_name));

        return vanityURLs[tokenId][_aliasName];
    }

    function getPrice(string calldata _name, string calldata _aliasName) external view returns (uint256) {
        bytes32 tokenId = keccak256(bytes(_name));

        return vanityURLPrices[tokenId][_aliasName];
    }

    function checkURLValidity(string memory _name, string memory _aliasName) public view returns (bool) {
        bytes32 tokenId = keccak256(bytes(_name));
        uint256 domainRegistrationAt = IDC(dc).nameExpires(_name) - IDC(dc).duration();

        return domainRegistrationAt < vanityURLUpdatedAt[tokenId][_aliasName] ? true : false;
    }

    function withdraw() external {
        require(msg.sender == owner() || msg.sender == revenueAccount, "D1DC: must be owner or revenue account");
        (bool success, ) = revenueAccount.call{value: address(this).balance}("");
        require(success, "D1DC: failed to withdraw");
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
