import React, { useEffect, useState } from 'react'
import Web3 from 'web3'
import detectEthereumProvider from '@metamask/detect-provider'
import config from '../config'
import { Button, FloatingText, Input, LinkWrarpper } from './components/Controls'
import { BaseText, Desc, DescLeft, SmallText, Title } from './components/Text'
import { Col, FlexRow, Main, Row } from './components/Layout'
import { TwitterTweetEmbed } from 'react-twitter-embed'
import styled from 'styled-components'
import humanizeDuration from 'humanize-duration'
import { toast } from 'react-toastify'
import apis, { relayApi } from './api'
import BN from 'bn.js'

const humanD = humanizeDuration.humanizer({ round: true, largest: 1 })

const Banner = styled(Col)`
  justify-content: center;
  border-bottom: 1px solid black;
  padding: 8px 16px;
  position: fixed;
  background: #eee;
`

const Container = styled(Main)`
  margin: 0 auto;
  padding: 0 16px;
  max-width: 800px;
  // TODO: responsive
`

const TweetContainerRow = styled(FlexRow)`
  width: 100%;
  div {
    width: 100%;
  }
`

const SmallTextGrey = styled(SmallText)`
  color: grey;
`

const Label = styled(SmallTextGrey)`
  margin-right: 16px;
`

const DescResponsive = styled(Desc)`
  @media(max-width: 640px){
    text-align: left;
    align-items: start;
  }
`

const getSubdomain = () => {
  if (!window) {
    return null
  }
  const host = window.location.host
  const parts = host.split('.')
  if (parts.length <= 2) {
    return ''
  }
  if (parts.length <= 3) {
    return parts[0]
  }
  return parts.slice(0, parts.length - 2).join('.')
}

const parseBN = (n) => {
  try {
    return new BN(n)
  } catch (ex) {
    console.error(ex)
    return null
  }
}

const parseTweetId = (urlInput) => {
  try {
    const url = new URL(urlInput)
    if (url.host !== 'twitter.com') {
      return { error: 'URL must be from https://twitter.com' }
    }
    const parts = url.pathname.split('/')
    const BAD_FORM = { error: 'URL has bad form. It must be https://twitter.com/[some_account]/status/[tweet_id]' }
    if (parts.length < 2) {
      return BAD_FORM
    }
    if (parts[parts.length - 2] !== 'status') {
      return BAD_FORM
    }
    const tweetId = parseBN(parts[parts.length - 1])
    if (!tweetId) {
      return { error: 'cannot parse tweet id' }
    }
    return { tweetId: tweetId.toString() }
  } catch (ex) {
    console.error(ex)
    return { error: ex.toString() }
  }
}

const Home = ({ subdomain = config.tld }) => {
  const [web3, setWeb3] = useState(new Web3(config.defaultRPC))
  const [address, setAddress] = useState('')
  const [client, setClient] = useState(apis({}))
  const [record, setRecord] = useState(null)
  // weakly random string
  const [secret] = useState(Math.random().toString(26).slice(2))
  const [lastRentedRecord, setLastRentedRecord] = useState(null)
  const [price, setPrice] = useState(null)
  const [parameters, setParameters] = useState({ rentalPeriod: 0, priceMultiplier: 0, registrarController: '' })
  const [tweetId, setTweetId] = useState('')
  const [pending, setPending] = useState(false)
  // TODO: add retry functionality
  const [regTxHash, setRegTxHash] = useState(false)
  const [isDomainAvailable, setIsDomainAvailable] = useState(false)

  // for updating stuff
  const [url, setUrl] = useState('')
  const [sld, setSld] = useState('')

  const name = getSubdomain()

  const isOwner = address && record?.renter && (record.renter.toLowerCase() === address.toLowerCase())

  const switchChain = async (address, silence) => {
    return window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: config.chainParameters.chainId }],
    }).then(() => {
      !silence && toast.success(`Switched to network: ${config.chainParameters.chainName}`)
      setClient(apis({ web3, address }))
    })
  }

  async function init () {
    const provider = await detectEthereumProvider()
    setWeb3(new Web3(provider))
  }

  const connect = async (silence) => {
    if (!window.ethereum) {
      !silence && toast.error('Wallet not found')
      return
    }
    try {
      const ethAccounts = await window.ethereum.request({ method: 'eth_requestAccounts' })

      if (ethAccounts.length >= 2) {
        return !silence && toast.info('Please connect using only one account')
      }
      const address = ethAccounts[0]
      setAddress(address)

      try {
        await switchChain(address, silence)
      } catch (ex) {
        console.error(ex)
        if (ex.code !== 4902) {
          !silence && toast.error(`Failed to switch to network ${config.chainParameters.chainName}: ${ex.message}`)
          return
        }
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [config.chainParameters]
          })
          !silence && toast.success(`Added ${config.chainParameters.chainName} Network on MetaMask`)
        } catch (ex2) {
          // message.error('Failed to add Harmony network:' + ex.toString())
          !silence && toast.error(`Failed to add network ${config.chainParameters.chainName}: ${ex.message}`)
        }
      }

      window.ethereum.on('accountsChanged', accounts => setAddress(accounts[0]))
      window.ethereum.on('networkChanged', networkId => {
        console.log('networkChanged', networkId)
        init()
      })
    } catch (ex) {
      console.error(ex)
    }
  }

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (web3 && !address) {
      connect(true)
    }
  }, [web3, address])

  useEffect(() => {
    setClient(apis({ web3, address }))
    if (!web3 || !address) {
      return
    }
    client.getPrice({ name }).then(p => setPrice(p))
  }, [web3, address])

  useEffect(() => {
    if (!client) {
      return
    }
    client.getParameters().then(p => setParameters(p))
    client.getRecord({ name }).then(r => setRecord(r))
    client.getPrice({ name }).then(p => setPrice(p))
  }, [client])

  useEffect(() => {
    if (!parameters?.lastRented) {
      return
    }
    client.getRecord({ name: parameters.lastRented }).then(r => setLastRentedRecord(r))
  }, [parameters?.lastRented])

  useEffect(() => {
    if (!record?.url) {
      return
    }
    const id = parseBN(record.url)
    if (!id) {
      return
    }
    setTweetId(id.toString())
  }, [record?.url])

  const showSuccess = (tx) => {
    console.log(tx)
    const { transactionHash } = tx
    toast.success(
      <FlexRow>
        <BaseText style={{ marginRight: 8 }}>Done!</BaseText>
        <LinkWrarpper target='_blank' href={client.getExplorerUri(transactionHash)}>
          <BaseText>View transaction</BaseText>
        </LinkWrarpper>
      </FlexRow>)
    setTimeout(() => location.reload(), 1500)
  }

  const onUpdateUrl = async () => {
    if (!url) {
      return toast.error('Invalid URL to embed')
    }
    setPending(true)
    try {
      const tweetId = parseTweetId(url)
      if (tweetId.error) {
        return toast.error(tweetId.error)
      }
      await client.updateURL({
        name,
        url: tweetId.tweetId.toString(),
        amount: new BN(price.amount).toString(),
        onFailed: () => toast.error('Failed to set URL'),
        onSuccess: showSuccess,
      })
    } catch (ex) {
      console.error(ex)
      toast.error(`Unexpected error: ${ex.toString()}`)
    } finally {
      setPending(false)
    }
  }

  const claimWeb2Domain = async (txHash) => {
    const { success, domainExpiryDate, responseText } = await relayApi().purchaseDomain({
      domain: `${sld}${config.tld}`, txHash, address
    })
    if (success) {
      toast.success(`Web2 domain acquired. Expiration: ${domainExpiryDate}`)
    } else {
      console.log(`failure reason: ${responseText}`)
      toast.error(`Unable to purchase web2 domain. Reason: ${responseText}`)
    }
  }

  const onRent = async () => {
    if (!url) {
      return toast.error('Invalid URL to embed')
    }
    if (!sld) {
      return toast.error('Invalid domain')
    }
    setPending(true)
    try {
      const tweetId = parseTweetId(url)
      if (tweetId.error) {
        return toast.error(tweetId.error)
      }
      await client.commit({
        registrarController: parameters.registrarController,
        name: sld,
        secret,
        onFailed: () => toast.error('Failed to commit purchase'),
        onSuccess: (tx) => {
          console.log(tx)
          const { transactionHash } = tx
          toast.success(
            <FlexRow>
              <BaseText style={{ marginRight: 8 }}>Reserved domain for purchase</BaseText>
              <LinkWrarpper target='_blank' href={client.getExplorerUri(transactionHash)}>
                <BaseText>View transaction</BaseText>
              </LinkWrarpper>
            </FlexRow>)
        }
      })
      const tx = await client.rent({
        name: sld,
        secret,
        url: tweetId.tweetId.toString(),
        amount: new BN(price.amount).toString(),
        onFailed: () => toast.error('Failed to purchase'),
        onSuccess: (tx) => {
          console.log(tx)
          const { transactionHash } = tx
          toast.success(
            <FlexRow>
              <BaseText style={{ marginRight: 8 }}>Done!</BaseText>
              <LinkWrarpper target='_blank' href={client.getExplorerUri(transactionHash)}>
                <BaseText>View transaction</BaseText>
              </LinkWrarpper>
            </FlexRow>)
        }
      })
      const txHash = tx.transactionHash
      setRegTxHash(txHash)
      await claimWeb2Domain(txHash)
    } catch (ex) {
      console.error(ex)
      toast.error(`Unexpected error: ${ex.toString()}`)
    } finally {
      setPending(false)
    }
  }

  useEffect(() => {
    if (!sld || !client) {
      return
    }
    async function f () {
      const { isAvailable } = await relayApi().checkDomain({ sld })
      const isAvailableWeb3 = await client.checkAvailable({ name: sld })
      console.log({ isAvailableWeb3, isAvailable })
      setIsDomainAvailable(isAvailable && isAvailableWeb3)
    }
    const timer = setTimeout(f, 1000)
    return () => { clearTimeout(timer) }
  }, [sld, client])

  const expired = record?.timeUpdated + parameters?.rentalPeriod - Date.now() < 0

  if (name === '') {
    return (
      <Container>
        {lastRentedRecord &&
          <Banner>
            <Row style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <SmallTextGrey>last purchase</SmallTextGrey>
              <a
                href={`https://${parameters.lastRented}${config.tld}`} target='_blank' rel='noreferrer'
                style={{ color: 'grey', textDecoration: 'none' }}
              ><BaseText>{parameters.lastRented}{config.tld}</BaseText>
              </a> <BaseText>({lastRentedRecord.lastPrice.formatted} ONE)</BaseText>
            </Row>
          </Banner>}
        <FlexRow style={{ alignItems: 'baseline', marginTop: 120 }}>
          <Title style={{ margin: 0 }}>Get your web3+2 {subdomain} domain</Title>
        </FlexRow>
        <DescLeft>
          <BaseText>How it works:</BaseText>
          <BaseText>- Here (<a href={`https://${config.tldHub}`}>{config.tldHub}</a>), you can rent a {config.tld} domain </BaseText>
          <BaseText>- It will be web3 compatible (tradable as NFT, displayable on ENS, wallets, and other services in the near future)</BaseText>
          <BaseText>- It also works in web2! You can visit the domain in your browser </BaseText>
          <BaseText>- You can configure the domain in many ways: Embed a tweet, setup a simple website (coming soon), configure DNS (coming soon), and many more </BaseText>
          <BaseText>- example: <a href={`https://${config.tldExample}`} target='_blank' rel='noreferrer'>{config.tldExample}</a></BaseText>
        </DescLeft>
        {!address && <Button onClick={connect} style={{ width: 'auto' }}>CONNECT METAMASK</Button>}
        {address &&
          <Col>
            <Title>Rent a domain now</Title>
            <Row style={{ width: '80%', gap: 0 }}>
              <Input $width='50%' $margin='8px' value={sld} onChange={({ target: { value } }) => setSld(value)} />
              <SmallTextGrey>.country</SmallTextGrey>
            </Row>
            <SmallTextGrey style={{ marginTop: 32 }}>Which tweet do you showcase in your domain?</SmallTextGrey>
            <Row style={{ width: '80%', gap: 0, position: 'relative' }}>
              <Input $width='100%' $margin='8px' value={url} onChange={({ target: { value } }) => setUrl(value)} />
              <FloatingText>copy the tweet's URL</FloatingText>
            </Row>
            <Button onClick={onRent} disabled={pending || !isDomainAvailable}>RENT</Button>
            <Col>
              <Row style={{ marginTop: 32, justifyContent: 'center' }}>
                <Label>price</Label><BaseText>{price?.formatted} ONE</BaseText>
              </Row>
              <Row style={{ justifyContent: 'center' }}>
                <SmallTextGrey>for {humanD(parameters.rentalPeriod)} </SmallTextGrey>
              </Row>
            </Col>
          </Col>}
      </Container>
    )
  }

  return (
    <Container>
      {lastRentedRecord &&
        <Banner>
          <Row style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <SmallTextGrey>last purchase</SmallTextGrey>
            <a
              href={`https://${parameters.lastRented}${config.tld}`} target='_blank' rel='noreferrer'
              style={{ color: 'grey', textDecoration: 'none' }}
            >
              <BaseText>{parameters.lastRented}{config.tld}</BaseText>
            </a> <BaseText>({lastRentedRecord.lastPrice.formatted} ONE)</BaseText>
          </Row>
        </Banner>}
      <FlexRow style={{ alignItems: 'baseline', marginTop: 120 }}>
        <Title style={{ margin: 0 }}>{name}</Title>
        <a href={`https://${config.tldHub}`} target='_blank' rel='noreferrer' style={{ textDecoration: 'none' }}>
          <BaseText style={{ fontSize: 12, color: 'grey', marginLeft: '16px', textDecoration: 'none' }}>
            {subdomain}
          </BaseText>
        </a>
      </FlexRow>
      {record?.renter &&
        <DescResponsive style={{ marginTop: 16 }}>
          <Row style={{ justifyContent: 'space-between' }}>

            {record.prev &&
              <a href={`https://${record.prev}${config.tld}`} target='_blank' rel='noreferrer' style={{ textDecoration: 'none' }}>
                <FlexRow style={{ gap: 16 }}>
                  <SmallTextGrey>{'<'} prev</SmallTextGrey><SmallTextGrey>{record.prev}{config.tld}</SmallTextGrey>
                </FlexRow>
              </a>}

            {record.next &&
              <a href={`https://${record.next}${config.tld}`} target='_blank' rel='noreferrer' style={{ textDecoration: 'none' }}>
                <FlexRow style={{ gap: 16 }}>
                  <SmallTextGrey>{record.next}{config.tld}</SmallTextGrey> <SmallTextGrey> next {'>'}</SmallTextGrey>
                </FlexRow>
              </a>}
          </Row>
          <Row style={{ marginTop: 16 }}>
            <Label>owned by</Label><BaseText style={{ wordBreak: 'break-word' }}>{record.renter}</BaseText>
          </Row>
          <Row>
            <Label>purchased on</Label>
            <BaseText> {new Date(record.timeUpdated).toLocaleString()}</BaseText>
          </Row>
          <Row>
            <Label>expires on</Label>
            <BaseText> {new Date(record.timeUpdated + parameters.rentalPeriod).toLocaleString()}</BaseText>
            {!expired && <SmallTextGrey>(in {humanD(record.timeUpdated + parameters.rentalPeriod - Date.now())})</SmallTextGrey>}
            {expired && <SmallText style={{ color: 'red' }}>(expired)</SmallText>}
          </Row>
          {tweetId &&
            <TweetContainerRow>
              <TwitterTweetEmbed tweetId={tweetId} />
            </TweetContainerRow>}
          <Row style={{ marginTop: 32, justifyContent: 'center' }}>
            {record.url && !tweetId &&
              <Col>
                <BaseText>Owner embedded an unsupported link:</BaseText>
                <SmallTextGrey> {record.url}</SmallTextGrey>
              </Col>}
            {!record.url &&
              <BaseText>Owner hasn't embedded any tweet yet</BaseText>}
          </Row>
          {!isOwner
            ? (
              <>
                <Title style={{ marginTop: 32, textAlign: 'center' }}>
                  This domain is already taken. Get your own at
                  <a href={`https://${config.tldHub}`} target='_blank' rel='noreferrer'>{config.tldHub}</a>
                </Title>
                <Row style={{ marginTop: 16, justifyContent: 'center' }}>
                  <Label>Price</Label><BaseText>{price?.formatted} ONE</BaseText>
                </Row>
                <Row style={{ justifyContent: 'center' }}>
                  <SmallTextGrey>for {humanD(parameters.rentalPeriod)} </SmallTextGrey>
                </Row>
              </>)
            : (
              <Title style={{ marginTop: 32, textAlign: 'center' }}>
                You own this page
              </Title>)}

        </DescResponsive>}

      {!address && isOwner && <Button onClick={connect} style={{ width: 'auto' }}>CONNECT METAMASK</Button>}

      {address && isOwner && (
        <>
          <SmallTextGrey style={{ marginTop: 32 }}>Which tweet do you want this page to embed?</SmallTextGrey>
          <Row style={{ width: '80%', gap: 0, position: 'relative' }}>
            <Input $width='100%' $margin='8px' value={url} onChange={({ target: { value } }) => setUrl(value)} />
            <FloatingText>copy the tweet's URL</FloatingText>
          </Row>
          <Button onClick={onUpdateUrl} disabled={pending}>UPDATE URL</Button>
          <Title style={{ marginTop: 64 }}>Renew ownership</Title>
          <Row style={{ justifyContent: 'center' }}>
            <Label>renewal price</Label><BaseText>{price?.formatted} ONE</BaseText>
          </Row>
          <SmallTextGrey>for {humanD(parameters.rentalPeriod)} </SmallTextGrey>
          <Button onClick={() => ({})} disabled>RENEW</Button>
          <SmallTextGrey>*Renewal is disabled at this time. It will be re-enabled in the coming months.</SmallTextGrey>
          <SmallTextGrey>Your address: {address}</SmallTextGrey>
        </>
      )}
      <SmallTextGrey>Learn more about the future of domain name services: <a href='https://harmony.one/domains' target='_blank' rel='noreferrer'>RADICAL Market for Internet Domains</a></SmallTextGrey>
      <div style={{ height: 200 }} />
    </Container>
  )
}

export default Home
