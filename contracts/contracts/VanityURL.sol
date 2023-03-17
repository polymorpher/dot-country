// SPDX-License-Identifier: CC-BY-NC-4.0

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./IDC.sol";

contract VanityURL is Ownable, Pausable, ReentrancyGuard {
    /// @dev DC contract
    address public dc;

    /// @dev DC TokenId -> Alias Name -> URL
    mapping(bytes32 => mapping(string => string)) public vanityURLs;

    /// @dev DC TokenId -> Alias Name -> Content Price
    mapping(bytes32 => mapping(string => uint256)) public vanityURLPrices;

    /// @dev DC Token Id -> Alias Name -> Timestamp when the URL was updated
    /// @dev Vanity URL is valid only if domainRegistrationAt <= vanityURLUpdatedAt
    mapping(bytes32 => mapping(string => uint256)) public vanityURLUpdatedAt;

    /// @dev Price for the url update
    uint256 public urlUpdatePrice;

    /// @dev Fee withdrawal address
    address public revenueAccount;

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

    modifier whenDomainNotExpired(string memory _name) {
        uint256 domainExpireAt = IDC(dc).nameExpires(_name);
        require(block.timestamp < domainExpireAt, "VanityURL: expired domain");
        _;
    }

    constructor(address _dc, uint256 _urlUpdatePrice, address _revenueAccount) {
        require(_dc != address(0), "VanityURL: zero address");
        require(_revenueAccount != address(0), "VanityURL: zero address");

        dc = _dc;
        urlUpdatePrice = _urlUpdatePrice;
        revenueAccount = _revenueAccount;
    }

    /// @notice Set the DC contract address
    /// @param _dc DC contract address
    function setDCAddress(address _dc) external onlyOwner {
        dc = _dc;
    }

    /// @notice Set the price for the URL update
    /// @param _urlUpdatePrice price for the URL update
    function setURLUpdatePrice(uint256 _urlUpdatePrice) external onlyOwner {
        urlUpdatePrice = _urlUpdatePrice;
    }

    /// @notice Set the revenue account
    /// @param _revenueAccount revenue account address
    function setRevenueAccount(address _revenueAccount) public onlyOwner {
        emit RevenueAccountChanged(revenueAccount, _revenueAccount);

        revenueAccount = _revenueAccount;
    }

    /// @notice Set a new URL
    /// @dev If the domain is expired, all the vanity URL info is erased
    /// @dev If the domain ownership is transferred but not expired, all the vanity URL info is kept
    /// @param _name domain name
    /// @param _aliasName alias name for the URL
    /// @param _url URL address to be redirected
    /// @param _price Price to paid for the URL access
    function setNewURL(
        string calldata _name,
        string calldata _aliasName,
        string calldata _url,
        uint256 _price
    ) external payable nonReentrant whenNotPaused onlyDCOwner(_name) whenDomainNotExpired(_name) {
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

    /// @notice Delete the existing URL
    /// @dev Deleting the URL is available regardless the domain expiration
    /// @param _name domain name
    /// @param _aliasName alias name for the URL to delete
    function deleteURL(string calldata _name, string calldata _aliasName) external whenNotPaused onlyDCOwner(_name) {
        require(checkURLValidity(_name, _aliasName), "VanityURL: url not exist");

        bytes32 tokenId = keccak256(bytes(_name));
        string memory url = vanityURLs[tokenId][_aliasName];

        // delete the URL
        vanityURLs[tokenId][_aliasName] = "";
        vanityURLPrices[tokenId][_aliasName] = 0;
        vanityURLUpdatedAt[tokenId][_aliasName] = block.timestamp;

        emit URLDeleted(msg.sender, _name, _aliasName, url);
    }

    /// @notice Update the existing URL
    /// @dev Updating the URL is not available if the domain is expired
    /// @param _name domain name
    /// @param _aliasName alias name for the URL
    /// @param _url URL address to be redirected
    /// @param _price Price to paid for the URL access
    function updateURL(
        string calldata _name,
        string calldata _aliasName,
        string calldata _url,
        uint256 _price
    ) external whenNotPaused onlyDCOwner(_name) whenDomainNotExpired(_name) {
        bytes32 tokenId = keccak256(bytes(_name));

        require(bytes(_url).length <= 1024, "VanityURL: url too long");
        require(checkURLValidity(_name, _aliasName), "VanityURL: invalid URL");

        emit URLUpdated(msg.sender, _name, _aliasName, vanityURLs[tokenId][_aliasName], _url, _price);

        // update the URL
        vanityURLs[tokenId][_aliasName] = _url;
        vanityURLPrices[tokenId][_aliasName] = _price;
        vanityURLUpdatedAt[tokenId][_aliasName] = block.timestamp;
    }

    /// @notice Returns the URL corresponding to the alias name
    /// @dev If the domain is expired, returns empty string
    /// @param _name domain name
    /// @param _aliasName alias name for the URL
    function getURL(string calldata _name, string calldata _aliasName) external view returns (string memory) {
        if (IDC(dc).nameExpires(_name) < block.timestamp) {
            return "";
        } else {
            bytes32 tokenId = keccak256(bytes(_name));

            return vanityURLs[tokenId][_aliasName];
        }
    }

    /// @notice Returns the price for the vanity URL access
    /// @dev If the domain is expired, returns 0
    /// @param _name domain name
    /// @param _aliasName alias name for the URL
    function getPrice(string calldata _name, string calldata _aliasName) external view returns (uint256) {
        if (IDC(dc).nameExpires(_name) < block.timestamp) {
            return 0;
        } else {
            bytes32 tokenId = keccak256(bytes(_name));

            return vanityURLPrices[tokenId][_aliasName];
        }
    }

    /// @notice Returns the validity of the vanity URL
    /// @dev If the domain is renewed, all the vanity URLs of the old domain are invalid
    /// @param _name domain name
    /// @param _aliasName alias name for the URL
    function checkURLValidity(string memory _name, string memory _aliasName) public view returns (bool) {
        bytes32 tokenId = keccak256(bytes(_name));
        uint256 domainRegistrationAt = IDC(dc).nameExpires(_name) - IDC(dc).duration();

        return domainRegistrationAt < vanityURLUpdatedAt[tokenId][_aliasName] ? true : false;
    }

    /// @notice Withdraw funds
    /// @dev Only owner of the revenue account can withdraw funds
    function withdraw() external {
        require(msg.sender == owner() || msg.sender == revenueAccount, "D1DC: must be owner or revenue account");
        (bool success, ) = revenueAccount.call{value: address(this).balance}("");
        require(success, "D1DC: failed to withdraw");
    }

    /// @notice Pause the contract
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the contract
    function unpause() external onlyOwner {
        _unpause();
    }
}
