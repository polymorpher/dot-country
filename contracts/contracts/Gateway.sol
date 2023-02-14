// SPDX-License-Identifier: CC-BY-NC-4.0

import "@openzeppelin/contracts/access/Ownable.sol";

pragma solidity ^0.8.17;

interface ID1DC {
    function getPrice(bytes32 encodedName, address dest) external view returns (uint256);

    function rent(string calldata name, string calldata url, address to) external payable;
}

interface IDC {
    function getPrice(string memory name) external view returns (uint256);

    function makeCommitment(string memory name, address owner, bytes32 secret) external view returns (bytes32);

    function commit(bytes32 commitment) external;

    function register(string calldata name, string calldata url, bytes32 secret, address to) external payable;
}

// requires a newer version of DC and D1DC contracts that allow domains/subdomains assigned "to" a particular address, instead of msg.sender
contract Gateway is Ownable {
    ID1DC public d1dc;
    IDC public dc;
    constructor(ID1DC _d1dc, IDC _dc){
        d1dc = _d1dc;
        dc = _dc;
    }
    function setGateways(ID1DC _d1dc, IDC _dc) onlyOwner public {
        d1dc = _d1dc;
        dc = _dc;
    }
    function getPrice(string memory name, address to) public view returns (uint256) {
        return d1dc.getPrice(keccak256(bytes(name)), to) + dc.getPrice(name);
    }
    function makeCommitment(string memory name, address owner, bytes32 secret)  external view returns (bytes32){
        return dc.makeCommitment(name,owner,secret);
    }
    function commit(bytes32 commitment) external {
        return dc.commit(commitment);
    }
    function rent(string calldata name, string calldata url, bytes32 secret, address to) external payable {
        uint256 price = getPrice(name, to);
        d1dc.rent(name, url, to);
        dc.register(name, url, secret, to);
        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            require(success, "cannot refund excess");
        }
    }

}