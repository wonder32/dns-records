# ???? DNS Records

**@layered/dns-records** is a DNS helper library than can quickly discover and retrieve all DNS records for a domain.

* Retrieves DNS records for a domain
* Discovers (almost) all A, AAAA, CNAME, and TXT for a domain
* Detects wildcard `*` records
* Option to specify extra subdomains to check for
* Provides results in common format, see `DnsRecord`
* Works in all JavaScript runtimes: Browsers, Node.js, CloudFlare Workers, Deno, Bun, etc

??? See it in action here https://dmns.app

## Startup
* ```git clone git@github.com:wonder32/dns-records.git dns```
* ```cd dns```
* ```npm link```
* ```getdns pudding.nl```


## Getting Started

#### Installation

```npm i @layered/dns-records```

#### Usage
The library has a simple API.
Use `getAllDnsRecords(domain)` to retrieve all DNS records for a domain OR request specific record types with `getDnsRecords(hostname, 'TXT')`

#### Example
```js
import { getDnsRecords, getAllDnsRecords } from '@layered/dns-records'

const txtRecords = await getDnsRecords('google.com', 'TXT')
const allRecords = await getAllDnsRecords('x.com')
```


## DNS Resolvers

Here is the list of supported DNS resolvers:

|Name|JS Runtime|Notes|
|:--|:--|:--|
|`cloudflare-dns`|Works on all|Requires `fetch` as global|
|`google-dns`|Works on all|Requires `fetch` as global|
|`node-dns`|Works only in Node.js|Uses [Node.js DNS module](https://nodejs.org/api/dns.html)|
|`node-dig`|Works only in Node.js|Uses [`dig` command](https://www.ibm.com/docs/en/aix/7.3?topic=d-dig-command)|
|`deno-dns`|Works only in Deno|Uses [Deno.resolveDns]([https://nodejs.org/api/dns.html](https://deno.land/api?s=Deno.resolveDns))|


## Client API
- [`getDnsRecords(hostname: string, type: string = 'A', resolver?)`](#dns-records-by-type) - Get DNS records for a hostname
- [`getAllDnsRecords(domain: string, options: GetAllDnsRecordsOptions)`](#all-dns-records) - Get all DNS records for a domain
- [`getAllDnsRecordsStream(domain: string, options): ReadableStream`](#all-dns-records-stream)

#### DNS Records by type

`getDnsRecords(name: string, type: string = 'A', resolver?): Promise<DnsRecord[]>`

|Params|type|default|description|
|-----|---|---|---|
|name |string|   |hostname. Ex: `'x.com'` or `email.apple.com`|
|type |string|`A`|record type: Ex: `'TXT'`, `'MX'`, `'CNAME'`|
|resolver |string|   |DNS resolver to use, see resolvers above. If not set, the best match for current runtime will be used|

```js
import { getDnsRecords } from '@layered/dns-records'

const records1 = await getDnsRecords('google.com', 'A')
console.log('DNS A records', records1)

const records2 = await getDnsRecords('google.com', 'TXT')
console.log('DNS TXT records', records2)
```

Returns a promise which resolves with an `DnsRecord[]` of records found:

```js
[ { name: 'google.com.',
    ttl: 608,
    type: 'TXT',
    data: '"v=spf1 include:_spf.google.com ~all"' },
  ...
]
```

#### All DNS records

`getAllDnsRecords(domain: string, options: GetAllDnsRecordsOptions): Promise<DnsRecord[]>`

|Params|type|description|
|-----|---|---|
|domain|string|Valid domain name, ex: `'google.com'`|
|options|object|see `GetAllDnsRecordsOptions`|

```js
import { getAllDnsRecords } from '@layered/dns-records'

const allRecords = await getAllDnsRecords('x.com', {
  resolver: 'cloudflare-dns',
  commonSubdomainsCheck: true,
})
console.log('DNS all records', allRecords)
```
Returns a Promise which resolves with `DnsRecord[]` of all records found:
```js
[ { name: 'x.com.', ttl: 3600, type: 'NS', data: 'ns71.domaincontrol.com.' },
  { name: 'x.com.', ttl: 3600, type: 'NS', data: 'ns72.domaincontrol.com.' },
  { name: 'x.com.', ttl: 600, type: 'SOA', data: 'ns71.domaincontrol.com. dns.jomax.net. 2018071100 28800 7200 604800 600' },
  { name: 'x.com.', ttl: 600, type: 'A', data: '160.153.63.10' },
  { name: 'x.com.', ttl: 600, type: 'A', data: '160.153.63.10' },
  { name: 'www.x.com.',  ttl: 3600, type: 'CNAME', data: 'x.com.' },
  { name: 'x.com.', ttl: 3600, type: 'MX', data: '10 mx-van.mail.am0.yahoodns.net.' }
]
```

## More

Please report any issues here on GitHub.
[Any contributions are welcome](CONTRIBUTING.md)

## License

[MIT](http://opensource.org/licenses/MIT)

Copyright (c) Andrei Igna, Layered
