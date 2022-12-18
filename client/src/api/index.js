import Contract from 'web3-eth-contract'
import config from '../../config'
import D1DC from '../../abi/D1DC.json'
import IBaseRegistrar from '../../abi/IBaseRegistrar.json'
import RegistrarController from '../../abi/RegistrarController.json'
import Constants from '../constants'
import BN from 'bn.js'
import axios from 'axios'

const base = axios.create({
  baseURL: process.env.REGISTRAR_RELAYER,
})

export const relayApi = () => {
  return {
    checkDomain: async ({ sld }) => {
      try {
        const {
          data: {
            isAvailable,
            isReserved,
            isRegistered,
            regPrice,
            renewPrice,
            transferPrice,
            restorePrice,
            responseText,
          },
        } = await base.post('/check-domain', { sld })
        return {
          isAvailable,
          isReserved,
          isRegistered,
          regPrice,
          renewPrice,
          transferPrice,
          restorePrice,
          responseText,
        }
      } catch (ex) {
        console.error(ex)
        return { error: ex.toString() }
      }
    },
    purchaseDomain: async ({ domain, txHash, address }) => {
      const {
        data: { success, domainCreationDate, domainExpiryDate, traceId, reqTime, responseText },
      } = await base.post('/purchase', { domain, txHash, address })
      return { success, domainCreationDate, domainExpiryDate, traceId, reqTime, responseText }
    },
  }
}

const apis = ({ web3, address }) => {
  if (!web3) {
    return
  }
  Contract.setProvider(web3.currentProvider)
  const contract = new Contract(D1DC, config.contract)

  const call = async ({ amount, onFailed, onSubmitted, onSuccess, methodName, parameters, callee = contract }) => {
    console.log({ methodName, parameters, amount, address })
    try {
      const testTx = await callee.methods[methodName](...parameters).call({ from: address, value: amount })
      if (config.debug) {
        console.log('testTx', methodName, parameters, testTx)
      }
    } catch (ex) {
      const err = ex.toString()
      console.error('testTx Error', err)
      onFailed && onFailed(ex)
      return null
    }
    onSubmitted && onSubmitted()
    try {
      const tx = await callee.methods[methodName](...parameters).send({ from: address, value: amount })
      if (config.debug) {
        console.log(methodName, JSON.stringify(tx))
      }
      console.log(methodName, tx?.events)
      onSuccess && onSuccess(tx)
      return tx
    } catch (ex) {
      onFailed && onFailed(ex, true)
    }
  }

  return {
    address,
    web3,
    getExplorerUri: (txHash) => {
      return config.explorer.replace('{{txId}}', txHash)
    },
    call,
    rent: async ({ name, url, duration = config.defaultDuration, amount, onFailed, onSubmitted, onSuccess }) => {
      return call({
        amount, parameters: [name, url, duration], methodName: 'rent', onFailed, onSubmitted, onSuccess
      })
    },
    commit: async ({ name, duration = config.defaultDuration, secret, onFailed, onSubmitted, onSuccess }) => {
      const rc = new Contract(RegistrarController, config.registrarController)
      const commitment = await rc.methods.makeCommitment(
        name, address,
        duration, secret,
        config.resolver,
        [], true,
        0, new BN(new Uint8Array(8).fill(255)).toString()
      ).call()
      return call({
        callee: config.registrarController,
        onFailed,
        onSubmitted,
        onSuccess,
        methodName: 'commit',
        parameters: [commitment]
      })
    },
    updateURL: async ({ name, url, onFailed, onSubmitted, onSuccess }) => {
      return call({
        parameters: [name, url], methodName: 'updateURL', onFailed, onSubmitted, onSuccess
      })
    },
    getParameters: async () => {
      const [baseRentalPrice, rentalPeriod, priceMultiplier, lastRented, registrarController] = await Promise.all([
        contract.methods.baseRentalPrice().call(),
        contract.methods.rentalPeriod().call(),
        contract.methods.priceMultiplier().call(),
        contract.methods.lastRented().call(),
        contract.methods.registrarController().call()
      ])
      return {
        baseRentalPrice: {
          amount: new BN(baseRentalPrice).toString(),
          formatted: web3.utils.fromWei(baseRentalPrice)
        },
        rentalPeriod: new BN(rentalPeriod).toNumber() * 1000,
        priceMultiplier: new BN(priceMultiplier).toNumber(),
        lastRented,
        registrarController
      }
    },
    getPrice: async ({ name }) => {
      const nameBytes = web3.utils.keccak256(name)
      const price = await contract.methods.getPrice(nameBytes).call({ from: address })
      const amount = new BN(price).toString()
      return {
        amount,
        formatted: web3.utils.fromWei(amount)
      }
    },
    getRecord: async ({ name }) => {
      const nameBytes = web3.utils.keccak256(name)
      const result = await contract.methods.nameRecords(nameBytes).call()
      const [renter, timeUpdated, lastPrice, url, prev, next] = Object.keys(result).map(k => result[k])
      return {
        renter: renter === Constants.EmptyAddress ? null : renter,
        lastPrice: {
          amount: lastPrice,
          formatted: web3.utils.fromWei(lastPrice)
        },
        timeUpdated: new BN(timeUpdated).toNumber() * 1000,
        url,
        prev,
        next
      }
    },
    checkAvailable: async ({name}) =>{
      const c = new Contract(IBaseRegistrar, config.registrar)
      const h = web3.utils.keccak256(name).slice(2)
      const isAvailable = await c.methods.available(new BN(h,'hex').toString()).call()
      return isAvailable
    }

    claimDomain: async ({ name, txHash }) => {

    }
  }
}
if (window) {
  window.apis = apis
}
export default apis
