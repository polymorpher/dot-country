// SPDX-License-Identifier: CC-BY-NC-4.0

pragma solidity ~0.8.17;

interface INameWrapper {
    function ownerOf(uint256) external view returns (address);
    function TLD_NODE() external view returns (bytes32);
}