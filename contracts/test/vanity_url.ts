import { expect } from "chai";
import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import config from '../config'

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";

import type { MockDC, VanityURL } from "../typechain-types"

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
const dotName = 'test.1.country'
const urlUpdatePrice = ethers.utils.parseEther("1");

const increaseTime = async (sec: number): Promise<void> => {
  await network.provider.send("evm_increaseTime", [sec]);
  await network.provider.send("evm_mine");
};

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

  let mockDC: MockDC;
  let vanityURL: VanityURL;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    [deployer, alice, bob, revenueAccount] = accounts;

    // Deploy MockDC contract
    const MockDC = await ethers.getContractFactory('MockDC');
    mockDC = (await MockDC.deploy()) as MockDC;

    // Deploy VanityURL contract
    const VanityURL = await ethers.getContractFactory("VanityURL");
    vanityURL = (await VanityURL.deploy(mockDC.address, urlUpdatePrice, revenueAccount.address)) as VanityURL;
  });

  describe("setRevenueAccount", () => {
    it("Should be able set the revenue account", async () => {
      expect(await vanityURL.revenueAccount()).to.equal(revenueAccount.address);
      
      await vanityURL.setRevenueAccount(alice.address);

      expect(await vanityURL.revenueAccount()).to.equal(alice.address);
    });

    it("Should revert if the caller is not owner", async () => {
      await expect(vanityURL.connect(alice).setRevenueAccount(alice.address)).to.be.reverted;
    });
  });

  describe("setNewURL", () => {
    const tokenId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(dotName));
    const aliasName = "aliasName";
    const url = "url";
    const price = ethers.utils.parseEther("2");

    beforeEach(async () => {
      await mockDC.connect(alice).register(dotName);
    });

    it("Should be able to set a new URL", async () => {
      expect(await vanityURL.vanityURLs(tokenId, aliasName)).to.equal("");
      expect(await vanityURL.vanityURLUpdatedAt(tokenId, aliasName)).to.equal(0);

      // set a new URL
      await vanityURL.connect(alice).setNewURL(dotName, aliasName, url, price, { value: urlUpdatePrice });

      expect(await vanityURL.vanityURLs(tokenId, aliasName)).to.equal(url);
      expect(await vanityURL.vanityURLPrices(tokenId, aliasName)).to.equal(price);
      expect(await vanityURL.vanityURLUpdatedAt(tokenId, aliasName)).to.equal(await getTimestamp());
    });

    it("Should be able to set a new URL after the domain ownership was changed but not expired", async () => {
      // transfer the ownership
      await mockDC.connect(bob).trasnferDomain(dotName);

      // set a new URL
      const newAliasName = "newAliasName";
      const newURL = "newURL";

      await vanityURL.connect(bob).setNewURL(dotName, newAliasName, newURL, price, { value: urlUpdatePrice });

      expect(await vanityURL.vanityURLs(tokenId, newAliasName)).to.equal(newURL);
    });

    it("Should revert if the caller is not the name owner", async () => {
      await expect(vanityURL.setNewURL(dotName, aliasName, url, price, { value: urlUpdatePrice })).to.be.revertedWith("VanityURL: only DC owner");
    });

    it("Should revert if the URL already exists", async () => {
      // set a new URL
      await vanityURL.connect(alice).setNewURL(dotName, aliasName, url, price, { value: urlUpdatePrice });

      // set the URL twice
      await expect(vanityURL.connect(alice).setNewURL(dotName, aliasName, url, price, { value: urlUpdatePrice })).to.be.revertedWith("VanityURL: url already exists");
    });

    it("Should revert if the payment is insufficient", async () => {
      await expect(vanityURL.connect(alice).setNewURL(dotName, aliasName, url, price, { value: urlUpdatePrice.sub(1) })).to.be.revertedWith("VanityURL: insufficient payment");
    });

    it("Should revert if the domain is expired", async () => {
      // increase time
      const duration = await mockDC.duration();
      await increaseTime(Number(duration.add(1)));

      // set a new URL
      const newAliasName = "newAliasName";
      const newURL = "newURL";

      await expect(vanityURL.connect(alice).setNewURL(dotName, newAliasName, newURL, price, { value: urlUpdatePrice })).to.be.revertedWith("VanityURL: expired domain")
    });
  });

  describe("deleteURL", () => {
    const tokenId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(dotName));
    const aliasName = "aliasName";
    const url = "url";
    const price = ethers.utils.parseEther("2");

    beforeEach(async () => {
      await mockDC.connect(alice).register(dotName);
      await vanityURL.connect(alice).setNewURL(dotName, aliasName, url, price, { value: urlUpdatePrice });
    });

    it("Should be able to delete the URL", async () => {
      const urlBefore = await vanityURL.vanityURLs(tokenId, aliasName);
      expect(urlBefore).to.equal(url);
      
      // delete the URL
      await vanityURL.connect(alice).deleteURL(dotName, aliasName);

      const urlAfter = await vanityURL.vanityURLs(tokenId, aliasName);
      const urlUpdatedAtAfter = await vanityURL.vanityURLUpdatedAt(tokenId, aliasName);
      expect(urlAfter).to.equal("");
      expect(urlUpdatedAtAfter).to.equal(await getTimestamp());
    });

    it("Should be able to delete the URL after the domain ownership was changed but not expired", async () => {
      // transfer the ownership
      await mockDC.connect(bob).trasnferDomain(dotName);

      // delete the URL
      await vanityURL.connect(bob).deleteURL(dotName, aliasName);

      expect(await vanityURL.vanityURLs(tokenId, aliasName)).to.equal("");
    });

    it("Should revert if the caller is not the name owner", async () => {
      await expect(vanityURL.deleteURL(dotName, aliasName)).to.be.revertedWith("VanityURL: only DC owner");
    });

    it("Should revert if the URL to delete doesn't exist", async () => {
      const newAliasName = "newAliasName";
      await expect(vanityURL.connect(alice).deleteURL(dotName, newAliasName)).to.be.revertedWith("VanityURL: url not exist");
    });
  });

  describe("updateURL", () => {
    const tokenId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(dotName));
    const aliasName = "aliasName";
    const url = "url";
    const price = ethers.utils.parseEther("2");
    const newPrice = ethers.utils.parseEther("3");

    beforeEach(async () => {
      await mockDC.connect(alice).register(dotName);
      await vanityURL.connect(alice).setNewURL(dotName, aliasName, url, price, { value: urlUpdatePrice });
    });
  
    it("Should be able to update the existing URL", async () => {
      const urlBefore = await vanityURL.vanityURLs(tokenId, aliasName);
      const priceBefore = await vanityURL.vanityURLPrices(tokenId, aliasName);
      expect(urlBefore).to.equal(url);
      expect(priceBefore).to.equal(price);

      // update the URL and price
      const newURL = "newURL";
      await vanityURL.connect(alice).updateURL(dotName, aliasName, newURL, newPrice);

      const urlAfter = await vanityURL.vanityURLs(tokenId, aliasName);
      const priceAfter = await vanityURL.vanityURLPrices(tokenId, aliasName);
      const urlUpdatedAtAfter = await vanityURL.vanityURLUpdatedAt(tokenId, aliasName);
      expect(urlAfter).to.equal(newURL);
      expect(priceAfter).to.equal(newPrice);
      expect(urlUpdatedAtAfter).to.equal(await getTimestamp());
    });

    it("Should be able to update after the domain ownership was changed but not expired", async () => {
      // transfer the ownership
      await mockDC.connect(bob).trasnferDomain(dotName);

      // update the URL
      const newURL = "newURL";
      await vanityURL.connect(bob).updateURL(dotName, aliasName, newURL, price);

      expect(await vanityURL.vanityURLs(tokenId, aliasName)).to.equal(newURL);
    });

    it("Should revert if the caller is not the name owner", async () => {
      const newURL = "newURL";
      await expect(vanityURL.updateURL(dotName, aliasName, newURL, price)).to.be.revertedWith("VanityURL: only DC owner");
    });

    it("Should revert if the domain is expired", async () => {
      // increase time
      const duration = await mockDC.duration();
      await increaseTime(Number(duration.add(1)));

      // set a new URL
      const newURL = "newURL";

      await expect(vanityURL.connect(alice).updateURL(dotName, aliasName, newURL, price)).to.be.revertedWith("VanityURL: expired domain");
    });
  });

  describe("getURL", () => {
    const tokenId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(dotName));
    const aliasName = "aliasName";
    const url = "url";
    const price = ethers.utils.parseEther("2");

    beforeEach(async () => {
      await mockDC.connect(alice).register(dotName);
      await vanityURL.connect(alice).setNewURL(dotName, aliasName, url, price, { value: urlUpdatePrice });
    });

    it("Should be able to returns the price", async () => {
      expect(await vanityURL.getURL(dotName, aliasName)).to.equal(url);
    });

    it("Should be able to return 0 if the domain is expired", async () => {
      // increase time
      const duration = await mockDC.duration();
      await increaseTime(Number(duration.add(1)));

      expect(await vanityURL.getURL(dotName, aliasName)).to.equal("");
    });
  });

  describe("getPrice", () => {
    const tokenId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(dotName));
    const aliasName = "aliasName";
    const url = "url";
    const price = ethers.utils.parseEther("2");

    beforeEach(async () => {
      await mockDC.connect(alice).register(dotName);
      await vanityURL.connect(alice).setNewURL(dotName, aliasName, url, price, { value: urlUpdatePrice });
    });

    it("Should be able to returns the price", async () => {
      expect(await vanityURL.getPrice(dotName, aliasName)).to.equal(price);
    });

    it("Should be able to return 0 if the domain is expired", async () => {
      // increase time
      const duration = await mockDC.duration();
      await increaseTime(Number(duration.add(1)));

      expect(await vanityURL.getPrice(dotName, aliasName)).to.equal(0);
    });
  });

  describe("withdraw", () => {
    const tokenId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(dotName));
    const aliasName = "aliasName";
    const url = "url";
    const price = ethers.utils.parseEther("2");

    beforeEach(async () => {
      await mockDC.connect(alice).register(dotName);
      await vanityURL.connect(alice).setNewURL(dotName, aliasName, url, price, { value: urlUpdatePrice });
    });

    it("should be able to withdraw ONE tokens", async () => {
      const revenueAccountBalanceBefore = await ethers.provider.getBalance(revenueAccount.address);
      
      // withdraw ONE tokens
      await vanityURL.connect(revenueAccount).withdraw();

      const revenueAccountBalanceAfter = await ethers.provider.getBalance(revenueAccount.address);
      expect(revenueAccountBalanceAfter).gt(revenueAccountBalanceBefore);
    });

    it("Should revert if the caller is not the owner or revenue account", async () => {
      await expect(vanityURL.connect(alice).withdraw()).to.be.revertedWith("D1DC: must be owner or revenue account");
    });
  });
});
