// SPDX-License-Identifier: MIT

pragma solidity ~0.8.17;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IBaseRegistrar is IERC721 {
    function nameExpires(uint256 id) external view returns (uint256);
}