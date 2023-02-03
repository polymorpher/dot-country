import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import config from '../config'
import fs from 'fs/promises'
import { chunk } from 'lodash'
import { DC } from '../typechain-types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  const maxWrapperExpiry = ethers.BigNumber.from(new Uint8Array(8).fill(255)).toString()
  const initConfiguration = {
    baseRentalPrice: ethers.utils.parseEther(config.baseRentalPrice).toString(),
    duration: config.duration * 3600 * 24,
    gracePeriod: config.gracePeriod * 3600 * 24,

    revenueAccount: config.revenueAccount,
    wrapperExpiry: maxWrapperExpiry,
    fuses: config.fuses,

    registrarController: config.registrarController,
    baseRegistrar: config.registrar,
    resolver: config.resolver,
    reverseRecord: config.reverseRecord
  }
  console.log(`DC initial Configuration: ${JSON.stringify(initConfiguration, null, 2)}`)

  const DC = await deploy('DC', {
    from: deployer,
    args: [initConfiguration],
    log: true,
    autoMine: true // speed up deployment on local network (ganache, hardhat), no effect on live networks
  })
  console.log('DC address:', DC.address)
  const dc = await ethers.getContractAt('DC', DC.address) as DC
  if (config.initialRecordFile) {
    const records:{name:string, key: string, record: DC.NameRecordStruct}[] = JSON.parse(await fs.readFile(config.initialRecordFile, { encoding: 'utf-8' }))
    const chunks = chunk(records, 50)
    await dc.initialize([ethers.utils.id('')], [{ renter: ethers.constants.AddressZero, lastPrice: '0', rentTime: '0', expirationTime: '0', url: '', prev: '', next: chunks[0][0].name }])
    for (const c of chunks) {
      const names = c.map(e => e.name)
      const records = c.map(e => {
        const { renter, rentTime, expirationTime, lastPrice, url } = e.record
        return { renter, rentTime, expirationTime, lastPrice, url, prev: '', next: '' }
      })
      console.log(`initializing ${names.length} records, starting from ${names[0]}: ${JSON.stringify(records[0])}`)
      await dc.initialize(names, records)
    }
  }
  await dc.finishInitialization()
  const n = (await dc.numRecords()).toNumber()
  console.log(`D1DC finished initialization for ${n} records`)

  const readConfiguration = {
    baseRentalPrice: ethers.utils.formatUnits(await dc.baseRentalPrice()),
    duration: (await dc.duration()).toString(),
    gracePeriod: (await dc.gracePeriod()).toString(),

    revenueAccount: await dc.revenueAccount(),
    wrapperExpiry: (await dc.wrapperExpiry()).toString(),
    fuses: await dc.fuses(),

    registrarController: await dc.registrarController(),
    baseRegistrar: await dc.baseRegistrar(),
    resolver: await dc.resolver(),
    reverseRecord: await dc.reverseRecord(),
    initialized: await dc.initialized()
  }
  console.log(`DC Read Configuration: ${JSON.stringify(readConfiguration, null, 2)}`)

  const getRecords = async (keys:string[]) => {
    const recordsRaw = await Promise.all(keys.map(k => dc.nameRecords(k)))
    return recordsRaw.map(({
      renter,
      rentTime,
      expirationTime,
      lastPrice,
      url,
      prev,
      next
    }) => {
      return {
        renter,
        rentTime: new Date(parseInt(rentTime.toString()) * 1000).toLocaleString(),
        expirationTime: new Date(parseInt(expirationTime.toString()) * 1000).toLocaleString(),
        lastPrice: ethers.utils.formatEther(lastPrice),
        url,
        prev,
        next
      }
    })
  }

  console.log(`key ${ethers.utils.id('')}, record:`, await getRecords([ethers.utils.id('')]))

  for (let i = 0; i < n; i += 50) {
    const keys = await dc.getRecordKeys(i, Math.min(n, i + 50))
    const records = await getRecords(keys)
    console.log(`Records ${i} to ${Math.min(n, i + 50)}: `, keys, records)
  }
}
export default func
func.tags = ['DC']
