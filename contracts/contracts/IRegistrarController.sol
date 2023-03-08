// SPDX-License-Identifier: CC-BY-NC-4.0

pragma solidity ~0.8.17;

interface IRegistrarController {
    function base() external view returns(address);

    struct Price {
        uint256 base;
        uint256 premium;
    }
    function rentPrice(string memory, uint256)
        external
        view
        returns (Price memory);

    function available(string memory) external view returns (bool);

    function makeCommitment(
        string memory,
        address,
        uint256,
        bytes32,
        address,
        bytes[] calldata,
        bool,
        uint32,
        uint64
    ) external view returns (bytes32);

    function commit(bytes32) external;

    function register(
        string calldata,
        address,
        uint256,
        bytes32,
        address,
        bytes[] calldata,
        bool,
        uint32,
        uint64
    ) external payable;

    function renew(string calldata, uint256) external payable;
}
