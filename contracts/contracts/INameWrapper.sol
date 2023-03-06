// SPDX-License-Identifier: MIT

pragma solidity ~0.8.17;

interface INameWrapper {
    function ownerOf(uint256) external view returns (address);
}