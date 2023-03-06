// SPDX-License-Identifier: MIT

pragma solidity ~0.8.17;

interface IDC {
    function available(string memory) external view returns (bool);
    function makeCommitment(string memory, address, uint256, bytes32) external view returns (bytes32);
    function commit(bytes32 commitment) external; 
    function getENSPrice(string memory, uint256) external view returns (uint256);
    function register(string calldata, address, uint256, bytes32) external payable;
    function renew(string calldata, uint256) external payable;
    function verifyOnwer(string calldata, address) external view returns(bool);
    function nameExpires(string calldata) external view returns(uint256);
    function ownerOf(string calldata name) external view returns(address);
}