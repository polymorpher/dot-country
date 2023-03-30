// SPDX-License-Identifier: CC-BY-NC-4.0

pragma solidity ^0.8.17;

import './DC.sol';
import './Tweet.sol';
import './LazyBundler.sol';
import "@openzeppelin/contracts/access/Ownable.sol";

contract DCDeployer is Ownable {
    DC public dc;
    Tweet public tt;
    LazyBundler public lb;

    constructor(address _ownerAccount) {
        transferOwnership(_ownerAccount);
    }

    function deploy(DC.InitConfiguration memory _initConfig, uint256 _baseRentalPrice, address _revenueAccount) external onlyOwner{
        dc = new DC(_initConfig);
        tt = new Tweet(Tweet.InitConfiguration(_baseRentalPrice,_revenueAccount,address(dc)));
        lb = new LazyBundler();
    }

    function transferOwner(address dest) external onlyOwner {
        dc.transferOwnership(dest);
        tt.transferOwnership(dest);
    }

    function withdraw() external onlyOwner {
        (bool success, ) = owner().call{value: address(this).balance}("");
        require(success, "withdraw failed");
    }

    function call(address dest, uint256 value, bytes memory data) external onlyOwner {
        (bool success, ) = dest.call{value: value}(data);
        require(success, "call failed");
    }
}