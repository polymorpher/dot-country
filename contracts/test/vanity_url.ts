import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import config from '../config'

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";

import type { DC, VanityURL } from "../typechain-types"

const maxWrapperExpiry = ethers.BigNumber.from(new Uint8Array(8).fill(255)).toString()
const initConfiguration = {
  wrapperExpiry: maxWrapperExpiry,
  fuses: config.fuses,
  registrarController: config.registrarController,
  nameWrapper: config.nameWrapper,
  baseRegistrar: config.registrar,
  resolver: config.resolver,
  reverseRecord: config.reverseRecord,
  duration: config.duration
}
const urlUpdatePrice = ethers.utils.parseEther("1");

const getTimestamp = async (): Promise<BigNumber> => {
  const blockNumber = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNumber);
  return BigNumber.from(block.timestamp);
};

describe('VanityURL', () => {
  let accounts: SignerWithAddress;
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let revenueAccount: SignerWithAddress;

  let dc: DC;
  let vanityURL: VanityURL;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    [deployer, alice, bob, revenueAccount] = accounts;

    // Deploy DC contract
    const DC = await ethers.getContractFactory('DC');
    dc = (await DC.deploy(initConfiguration)) as DC;

    // Deploy VanityURL contract
    const VanityURL = await ethers.getContractFactory("VanityURL");
    vanityURL = (await VanityURL.deploy(dc.address, urlUpdatePrice, revenueAccount.address)) as VanityURL;
  });

  describe("setRevenueAccount", () => {
    it.only("Should be able set the revenue account", async () => {
      expect(await vanityURL.revenueAccount()).to.equal(revenueAccount.address);
      
      await vanityURL.setRevenueAccount(alice.address);

      expect(await vanityURL.revenueAccount()).to.equal(alice.address);
    });

    it("Should revert if the caller is not owner", async () => {
      await expect(vanityURL.connect(alice).setRevenueAccount(alice.address)).to.be.reverted;
    });
  });

  // describe("setNewURL", () => {
  //   const tokenId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(dotName));
  //   const aliasName = "aliasName";
  //   const url = "url";
  //   const price = ethers.utils.parseEther("2");

  //   beforeEach(async () => {
  //     await d1dcV2.connect(alice).rent(dotName, url, telegram, email, phone, { value: baseRentalPrice });
  //   });

  //   it("Should be ale to set a new URL", async () => {
  //     expect(await vanityURL.vanityURLs(tokenId, aliasName)).to.equal("");
  //     expect(await vanityURL.vanityURLUpdatedAt(tokenId, aliasName)).to.equal(0);

  //     // set a new URL
  //     await vanityURL.connect(alice).setNewURL(dotName, aliasName, url, price, { value: urlUpdatePrice });

  //     expect(await vanityURL.vanityURLs(tokenId, aliasName)).to.equal(url);
  //     expect(await vanityURL.vanityURLPrices(tokenId, aliasName)).to.equal(price);
  //     expect(await vanityURL.vanityURLUpdatedAt(tokenId, aliasName)).to.equal(await getTimestamp());
  //   });

  //   it("Should revert if the caller is not the name owner", async () => {
  //     await expect(vanityURL.setNewURL(dotName, aliasName, url, price, { value: urlUpdatePrice })).to.be.revertedWith("VanityURL: only D1DCV2 name owner");
  //   });

  //   it("Should revert if the URL already exists", async () => {
  //     // set a new URL
  //     await vanityURL.connect(alice).setNewURL(dotName, aliasName, url, price, { value: urlUpdatePrice });

  //     // set the URL twice
  //     await expect(vanityURL.connect(alice).setNewURL(dotName, aliasName, url, price, { value: urlUpdatePrice })).to.be.revertedWith("VanityURL: url already exists");
  //   });

  //   it("Should revert if the payment is insufficient", async () => {
  //     await expect(vanityURL.connect(alice).setNewURL(dotName, aliasName, url, price, { value: urlUpdatePrice.sub(1) })).to.be.revertedWith("VanityURL: insufficient payment");
  //   });
  // });

  // describe("deleteURL", () => {
  //   const tokenId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(dotName));
  //   const aliasName = "aliasName";
  //   const url = "url";
  //   const price = ethers.utils.parseEther("2");

  //   beforeEach(async () => {
  //     await d1dcV2.connect(alice).rent(dotName, url, telegram, email, phone, { value: baseRentalPrice });
  //     await vanityURL.connect(alice).setNewURL(dotName, aliasName, url, price, { value: urlUpdatePrice });
  //   });

  //   it("Should be able to delete the URL", async () => {
  //     const urlBefore = await vanityURL.vanityURLs(tokenId, aliasName);
  //     const urlUpdateAtBefore = await vanityURL.vanityURLUpdatedAt(tokenId, aliasName);
  //     expect(urlBefore).to.equal(url);
      
  //     // delete the URL
  //     await vanityURL.connect(alice).deleteURL(dotName, aliasName);

  //     const urlAfter = await vanityURL.vanityURLs(tokenId, aliasName);
  //     const urlUpdateAtAfter = await vanityURL.vanityURLUpdatedAt(tokenId, aliasName);
  //     expect(urlAfter).to.equal("");
  //     expect(urlUpdateAtAfter).to.equal(await getTimestamp());
  //   });

  //   it("Should revert if the caller is not the name owner", async () => {
  //     await expect(vanityURL.deleteURL(dotName, aliasName)).to.be.revertedWith("VanityURL: only D1DCV2 name owner");
  //   });

  //   it("Should revert if the URL to delete doesn't exist", async () => {
  //     const newAliasName = "newAliasName";
  //     await expect(vanityURL.connect(alice).deleteURL(dotName, newAliasName)).to.be.revertedWith("VanityURL: invalid URL");
  //   });
  // });

  // describe("updateURL", () => {
  //   const tokenId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(dotName));
  //   const aliasName = "aliasName";
  //   const url = "url";
  //   const price = ethers.utils.parseEther("2");
  //   const newPrice = ethers.utils.parseEther("3");

  //   beforeEach(async () => {
  //     await d1dcV2.connect(alice).rent(dotName, url, telegram, email, phone, { value: baseRentalPrice });
  //     await vanityURL.connect(alice).setNewURL(dotName, aliasName, url, price, { value: urlUpdatePrice });
  //   });
  
  //   it("Should be able to update the existing URL", async () => {
  //     const urlBefore = await vanityURL.vanityURLs(tokenId, aliasName);
  //     const priceBefore = await vanityURL.vanityURLPrices(tokenId, aliasName);
  //     const urlUpdateAtBefore = await vanityURL.vanityURLUpdatedAt(tokenId, aliasName);
  //     expect(urlBefore).to.equal(url);
  //     expect(priceBefore).to.equal(price);

  //     // update the URL and price
  //     const newURL = "newURL";
  //     await vanityURL.connect(alice).updateURL(dotName, aliasName, newURL, newPrice);

  //     const urlAfter = await vanityURL.vanityURLs(tokenId, aliasName);
  //     const priceAfter = await vanityURL.vanityURLPrices(tokenId, aliasName);
  //     const urlUpdateAtAfter = await vanityURL.vanityURLUpdatedAt(tokenId, aliasName);
  //     expect(urlAfter).to.equal(newURL);
  //     expect(priceAfter).to.equal(newPrice);
  //     expect(urlUpdateAtAfter).to.equal(await getTimestamp());
  //   });

  //   it("Should revert if the caller is not the name owner", async () => {
  //     const newURL = "newURL";
  //     await expect(vanityURL.updateURL(dotName, aliasName, newURL, price)).to.be.revertedWith("VanityURL: only D1DCV2 name owner");
  //   });

  //   it("Should revert if the URL to update is invalid", async () => {
  //     // transfer the NFT
  //     await d1dcV2.connect(alice)["safeTransferFrom(address,address,uint256)"](alice.address, bob.address, tokenId);

  //     const newURL = "newURL";
  //     await expect(vanityURL.connect(bob).updateURL(dotName, aliasName, newURL, price)).to.be.revertedWith("VanityURL: invalid URL");
  //   });
  // });

  // describe("withdraw", () => {
  //   const tokenId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(dotName));
  //   const aliasName = "aliasName";
  //   const url = "url";
  //   const price = ethers.utils.parseEther("2");

  //   beforeEach(async () => {
  //     await d1dcV2.connect(alice).rent(dotName, url, telegram, email, phone, { value: baseRentalPrice });
  //     await vanityURL.connect(alice).setNewURL(dotName, aliasName, url, price, { value: urlUpdatePrice });
  //   });

  //   it("should be able to withdraw ONE tokens", async () => {
  //     const revenueAccountBalanceBefore = await ethers.provider.getBalance(revenueAccount.address);
      
  //     // withdraw ONE tokens
  //     await vanityURL.connect(revenueAccount).withdraw();

  //     const revenueAccountBalanceAfter = await ethers.provider.getBalance(revenueAccount.address);
  //     expect(revenueAccountBalanceAfter).gt(revenueAccountBalanceBefore);
  //   });

  //   it("Should revert if the caller is not the owner or revenue account", async () => {
  //     await expect(vanityURL.connect(alice).withdraw()).to.be.revertedWith("D1DC: must be owner or revenue account");
  //   });
  // });
});
