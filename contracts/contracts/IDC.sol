// SPDX-License-Identifier: CC-BY-NC-4.0

pragma solidity ~0.8.17;

interface IDC {
    function available(string memory) external view returns (bool);
    function duration() external view returns (uint256);
    function makeCommitment(string memory, address, bytes32) external view returns (bytes32);
    function commit(bytes32 commitment) external; 
    function getPrice(string memory) external view returns (uint256);
    function register(string calldata, address, bytes32) external payable;
    function renew(string calldata) external payable;
    function nameExpires(string calldata) external view returns(uint256);
    function ownerOf(string calldata name) external view returns(address);
}