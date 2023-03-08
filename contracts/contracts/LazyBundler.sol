// SPDX-License-Identifier: CC-BY-NC-4.0

pragma solidity ~0.8.17;

contract LazyBundler {
    function multicall(address[] memory dests, bytes[] memory data, uint256[] memory values) public payable {
        for (uint256 i = 0; i < dests.length; i++) {
            (bool success,) = dests[i].call{value : values[i]}(data[i]);
            if (success == false) {
                assembly {
                    let ptr := mload(0x40)
                    let size := returndatasize()
                    returndatacopy(ptr, 0, size)
                    revert(ptr, size)
                }
            }
        }
    }
}