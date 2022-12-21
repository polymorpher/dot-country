import Contract from 'web3-eth-contract'
import config from '../../config'
import DC from '../../abi/DC.json'
import Constants from '../constants'
import BN from 'bn.js'
import axios from 'axios'
import { utils } from '../utils'

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
  const contract = new Contract(DC, config.contract)

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
    rent: async ({ name, url, secret, amount, onFailed, onSubmitted, onSuccess }) => {
      const secretHash = utils.keccak256(secret, true)
      // console.log({ secretHash })
      return call({
        amount, parameters: [name, url, secretHash], methodName: 'register', onFailed, onSubmitted, onSuccess
      })
    },
    commit: async ({ name, secret, onFailed, onSubmitted, onSuccess }) => {
      const secretHash = utils.keccak256(secret, true)
      const commitment = await contract.methods.makeCommitment(name, address, secretHash).call()
      return call({
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
      const [baseRentalPrice, duration, lastRented] = await Promise.all([
        contract.methods.baseRentalPrice().call(),
        contract.methods.duration().call(),
        contract.methods.lastRented().call()
      ])
      return {
        baseRentalPrice: {
          amount: new BN(baseRentalPrice).toString(),
          formatted: web3.utils.fromWei(baseRentalPrice)
        },
        duration: new BN(duration).toNumber() * 1000,
        lastRented,
      }
    },
    getPrice: async ({ name }) => {
      const price = await contract.methods.getPrice(name).call({ from: address })
      const amount = new BN(price).toString()
      return {
        amount,
        formatted: web3.utils.fromWei(amount)
      }
    },
    getRecord: async ({ name }) => {
      const nameBytes = utils.keccak256(name, true)
      const result = await contract.methods.nameRecords(nameBytes).call()
      const [renter, rentTime, expirationTime, lastPrice, url, prev, next] = Object.keys(result).map(k => result[k])
      return {
        renter: renter === Constants.EmptyAddress ? null : renter,
        rentTime: new BN(rentTime).toNumber() * 1000,
        expirationTime: new BN(expirationTime).toNumber() * 1000,
        lastPrice: {
          amount: lastPrice,
          formatted: web3.utils.fromWei(lastPrice)
        },
        url,
        prev,
        next
      }
    },
    checkAvailable: async ({ name }) => {
      const isAvailable = await contract.methods.available(name).call()
      return isAvailable?.toString()?.toLowerCase() === 'true'
    }
  }
}
if (window) {
  window.apis = apis
}
export default apis
