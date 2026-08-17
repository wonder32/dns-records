#!/usr/bin/env node

/**
 * getdns — show all public DNS records for a domain
 *
 *   getdns pudding.nl
 *   getdns pudding.nl MX
 *   getdns pudding.nl --resolver=cloudflare-dns
 *
 * Thin CLI on top of @layered/dns-records (this repo).
 * https://github.com/LayeredStudio/dns-records
 */

import { getAllDnsRecords, getDnsRecords } from '@layered/dns-records'

const VALID_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'PTR', 'SRV', 'CAA', 'NAPTR', 'DS', 'DNSKEY', 'SIG', 'KEY']
const RESOLVERS = ['node-dig', 'node-dns', 'cloudflare-dns', 'google-dns']

// order the record types are printed in — unknown types are appended alphabetically
const TYPE_ORDER = ['NS', 'SOA', 'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'CAA', 'SRV', 'PTR', 'NAPTR', 'DS', 'DNSKEY']

/* ---------------------------------------------------------------- colors -- */

const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR && !process.argv.includes('--no-color')
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s))

const c = {
	bold: paint('1'),
	dim: paint('2'),
	red: paint('31'),
	green: paint('32'),
	yellow: paint('33'),
	blue: paint('34'),
	magenta: paint('35'),
	cyan: paint('36'),
}

const TYPE_COLOR = {
	NS: c.blue,
	SOA: c.dim,
	A: c.green,
	AAAA: c.green,
	CNAME: c.magenta,
	MX: c.yellow,
	TXT: c.cyan,
	CAA: c.blue,
}
const colorType = (type) => (TYPE_COLOR[type] || c.bold)(type)

/* ------------------------------------------------------------------ args -- */

function usage() {
	console.log(`${c.bold('getdns')} — show all public DNS records for a domain

${c.bold('Usage')}
  getdns <domain> [type] [options]

${c.bold('Arguments')}
  domain              domain to look up, e.g. ${c.cyan('pudding.nl')} (a full URL works too)
  type                show only this record type, e.g. ${c.cyan('MX')}
                      one of: ${VALID_TYPES.join(', ')}
                      (single lookup, so no subdomain discovery — much faster)

${c.bold('Options')}
  -r, --resolver <r>  ${RESOLVERS.join(' | ')}
                      default: node-dig, falls back to node-dns if dig is missing
      --no-color      plain output without colors (NO_COLOR is honoured too)
  -h, --help          show this help

${c.bold('Examples')}
  getdns pudding.nl
  getdns pudding.nl MX
  getdns pudding.nl --resolver=cloudflare-dns
`)
}

function parseArgs(argv) {
	const opts = { domain: '', type: '', resolver: '' }
	const positional = []

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]

		if (arg === '-h' || arg === '--help') {
			return { help: true }
		} else if (arg === '--no-color') {
			continue // already handled when setting up colors
		} else if (arg === '-r' || arg === '--resolver') {
			opts.resolver = argv[++i] || ''
		} else if (arg.startsWith('--resolver=')) {
			opts.resolver = arg.slice('--resolver='.length)
		} else if (arg.startsWith('-')) {
			return { error: `Unknown option: ${arg}` }
		} else {
			positional.push(arg)
		}
	}

	if (!positional.length) return { help: true }

	opts.domain = cleanDomain(positional[0])
	if (!opts.domain) return { error: `Not a valid domain: ${positional[0]}` }

	if (positional[1]) {
		opts.type = positional[1].toUpperCase()
		if (!VALID_TYPES.includes(opts.type)) {
			return { error: `Unknown record type: ${positional[1]}\n  Valid types: ${VALID_TYPES.join(', ')}` }
		}
	}

	if (opts.resolver && !RESOLVERS.includes(opts.resolver)) {
		return { error: `Unknown resolver: ${opts.resolver}\n  Valid resolvers: ${RESOLVERS.join(', ')}` }
	}

	return opts
}

/** accepts pudding.nl, https://pudding.nl/path, me@pudding.nl, pudding.nl. */
function cleanDomain(input) {
	let domain = String(input).trim().toLowerCase()
	domain = domain.replace(/^[a-z][a-z0-9+.-]*:\/\//, '') // protocol
	domain = domain.replace(/^[^/@]*@/, '') // userinfo or email local part
	domain = domain.split(/[/?#]/)[0] // path, query, hash
	domain = domain.replace(/:\d+$/, '') // port
	domain = domain.replace(/\.+$/, '') // trailing root dot
	return /^[^\s.]+(\.[^\s.]+)+$/.test(domain) ? domain : ''
}

/** the node-dig resolver shells out to `dig` — check it exists before using it */
async function digAvailable() {
	const { spawnSync } = await import('node:child_process')
	return !spawnSync('dig', ['-v']).error
}

/* ---------------------------------------------------------------- output -- */

function sortRecords(records, domain) {
	const rank = (type) => {
		const i = TYPE_ORDER.indexOf(type)
		return i === -1 ? TYPE_ORDER.length : i
	}

	return [...records].sort((a, b) => {
		if (rank(a.type) !== rank(b.type)) return rank(a.type) - rank(b.type)
		if (a.type !== b.type) return a.type.localeCompare(b.type)
		if (a.name !== b.name) {
			if (a.name === domain) return -1
			if (b.name === domain) return 1
			const depth = a.name.split('.').length - b.name.split('.').length
			if (depth) return depth
			return a.name.localeCompare(b.name)
		}
		return String(a.data).localeCompare(String(b.data), undefined, { numeric: true })
	})
}

/** dim the shared domain suffix so the subdomain stands out */
function colorName(name, domain) {
	if (!useColor || name === domain) return name
	if (!name.endsWith(`.${domain}`)) return name

	const label = name.slice(0, -(domain.length + 1))
	return `${label.startsWith('*') ? c.yellow(label) : label}${c.dim(`.${domain}`)}`
}

function printRecords(records, domain) {
	const sorted = sortRecords(records, domain)
	const termWidth = Math.max(process.stdout.columns || 100, 60)

	// one set of column widths for the whole output, so every group lines up
	const nameWidth = Math.min(Math.max(...sorted.map((r) => r.name.length)), 40)
	const ttlWidth = Math.max(...sorted.map((r) => formatTtl(r.ttl).length), 3)
	const dataIndent = 4 + nameWidth + 2 + ttlWidth + 2
	const dataWidth = Math.max(termWidth - dataIndent - 1, 24)

	const counts = {}
	sorted.forEach((r) => (counts[r.type] = (counts[r.type] || 0) + 1))

	let lastType = ''

	for (const record of sorted) {
		if (record.type !== lastType) {
			if (lastType) console.log('')
			const count = counts[record.type]
			console.log(`  ${colorType(record.type)}${count > 1 ? c.dim(` (${count})`) : ''}`)
			lastType = record.type
		}

		const pad = ' '.repeat(Math.max(nameWidth - record.name.length, 0))
		const name = colorName(record.name, domain) + pad
		const ttl = c.dim(formatTtl(record.ttl).padStart(ttlWidth))
		const data = wrap(String(record.data), dataWidth)

		console.log(`    ${name}  ${ttl}  ${styleData(record, data[0])}`)
		for (const rest of data.slice(1)) {
			console.log(`${' '.repeat(dataIndent)}${styleData(record, rest)}`)
		}
	}
}

/** dig does not report a TTL for every record — show a dash instead of 0 */
const formatTtl = (ttl) => (Number(ttl) > 0 ? String(Number(ttl)) : '-')

/** subtle emphasis inside record data */
function styleData(record, text) {
	if (!useColor) return text

	if (record.type === 'MX') {
		return text.replace(/^(\d+)\s+(\S+)/, (_, prio, host) => `${c.dim(prio)} ${host}`)
	}
	if (record.type === 'TXT') {
		return text.replace(/(v=spf1|v=DMARC1|v=DKIM1|~all|-all|\?all|\+all)/g, (m) => c.bold(m))
	}
	if (record.type === 'SOA') {
		return c.dim(text)
	}
	return text
}

/** wrap long values (SPF, DKIM keys) on spaces, hard-splitting unbreakable blobs */
function wrap(text, width) {
	if (text.length <= width) return [text]

	const lines = []
	let line = ''

	for (const word of text.split(' ')) {
		if (!line) {
			line = word
		} else if (line.length + 1 + word.length <= width) {
			line += ` ${word}`
		} else {
			lines.push(line)
			line = word
		}
	}
	if (line) lines.push(line)

	return lines.flatMap((l) => (l.length <= width ? [l] : l.match(new RegExp(`.{1,${width}}`, 'g'))))
}

/* ------------------------------------------------------------------ main -- */

const opts = parseArgs(process.argv.slice(2))

if (opts.help) {
	usage()
	process.exit(0)
}
if (opts.error) {
	console.error(`${c.red('✖')} ${opts.error}\n  Run ${c.bold('getdns --help')} for usage.`)
	process.exit(2)
}

let resolver = opts.resolver

if (!resolver) {
	resolver = (await digAvailable()) ? 'node-dig' : 'node-dns'
} else if (resolver === 'node-dig' && !(await digAvailable())) {
	console.error(`${c.yellow('!')} \`dig\` was not found, falling back to node-dns`)
	resolver = 'node-dns'
}

// little progress hint, only on a terminal and only if the lookup takes a moment
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
let spinner = null
const spinnerStart = process.stderr.isTTY
	? setTimeout(() => {
			let i = 0
			spinner = setInterval(() => process.stderr.write(`\r${c.dim(`  ${FRAMES[i++ % FRAMES.length]} looking up ${opts.domain} …`)}`), 90)
		}, 300)
	: null

const stopSpinner = () => {
	clearTimeout(spinnerStart)
	if (spinner) {
		clearInterval(spinner)
		process.stderr.write('\r\x1b[2K')
	}
}

const startedAt = Date.now()

try {
	const records = opts.type
		? await getDnsRecords(opts.domain, opts.type, resolver)
		: await getAllDnsRecords(opts.domain, { resolver })

	stopSpinner()

	if (!records.length) {
		console.log(
			`\n  ${c.bold(opts.domain)} ${c.dim('·')} ${c.yellow(`no ${opts.type || 'DNS'} records found`)}\n  ` +
				c.dim(opts.type ? `The domain has no ${opts.type} records.` : 'No nameservers answered — is the domain registered?') +
				'\n',
		)
		process.exit(1)
	}

	const summary = [
		c.bold(opts.domain),
		`${records.length} record${records.length === 1 ? '' : 's'}`,
		opts.type ? `type ${opts.type}` : `${new Set(records.map((r) => r.type)).size} types`,
		resolver,
		`${Date.now() - startedAt} ms`,
	].join(c.dim(' · '))

	console.log(`\n  ${summary}\n`)
	printRecords(records, opts.domain)
	console.log('')
} catch (err) {
	stopSpinner()
	console.error(`${c.red('✖')} Lookup failed for ${c.bold(opts.domain)}: ${err.message}`)
	process.exit(1)
}
