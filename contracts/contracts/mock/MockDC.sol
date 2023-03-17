// SPDX-License-Identifier: CC-BY-NC-4.0

pragma solidity ^0.8.17;

contract MockDC {
    /// @dev Renting duration
    uint256 public constant DURATION = 90 days;

    /// @dev Domain -> Owner
    mapping(string => address) public owners;

    /// @dev Domain -> Expiration timestamp
    mapping(string => uint256) public expires;

    constructor() {}

    function register(string calldata name) external {
        owners[name] = msg.sender;
        expires[name] = block.timestamp + DURATION;
    }

    function duration() external pure returns (uint256) {
        return DURATION;
    }

    function nameExpires(string calldata name) external view returns (uint256) {
        return expires[name];
    }

    function ownerOf(string calldata name) external view returns (address) {
        return owners[name];
    }
}
