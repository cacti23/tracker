// 🗺️ AWS map: one e-commerce request (order + payment) followed through every AWS box.
// Data first (zones, subnets, nodes, firewalls, routes, traces), then the engine that draws and plays it.
// To grow the map: add a node to NODES (x, y, w, h in map pixels, inside its subnet), then use its id
// in a trace step. test/aws-map.test.js checks that every id, rule row and waypoint resolves.
;(function (root) {
'use strict'

const MAP = { W: 1440, H: 680 }

// Background areas, drawn first. k picks the style.
const ZONES = [
  { id: 'inet', x: 10, y: 10, w: 190, h: 632, t: '🌍 Internet', k: 'inet' },
  { id: 'edge', x: 210, y: 10, w: 190, h: 632, t: '🌐 AWS edge · worldwide', k: 'edge' },
  { id: 'region', x: 410, y: 10, w: 1020, h: 632, t: '🏙️ AWS Region ap-south-1 · Mumbai', k: 'region' },
  { id: 'vpc', x: 498, y: 40, w: 704, h: 596, t: '☁️ VPC shopkart-prod · 10.0.0.0/16', k: 'vpc' },
  { id: 'az-a', x: 504, y: 66, w: 692, h: 252, t: 'AZ a · ap-south-1a', k: 'az' },
  { id: 'az-b', x: 504, y: 386, w: 692, h: 244, t: 'AZ b · ap-south-1b', k: 'az' },
  { id: 'svc', x: 1262, y: 40, w: 162, h: 596, t: '🧰 AWS services · outside the VPC', k: 'svc' },
]

// Subnets: each has one NACL (its border guard) and one route table (its signpost).
const SUBNETS = {
  'pub-a': { x: 520, y: 76, w: 180, h: 236, t: '🟢 Public a', cidr: '10.0.0.0/24', az: 'a', nacl: 'nacl-pub', rt: 'rt-pub', k: 'pub',
    what: 'The front door of AZ a. Holds the ALB\'s AZ-a node and NAT Gateway a. Public only because its route table sends 0.0.0.0/0 to the Internet Gateway.' },
  'app-a': { x: 714, y: 76, w: 286, h: 236, t: '🔒 App a', cidr: '10.0.10.0/24', az: 'a', nacl: 'nacl-app', rt: 'rt-app-a', k: 'app',
    what: 'The services of AZ a. Nobody on the internet can open a connection in. They call out through NAT a.' },
  'data-a': { x: 1012, y: 76, w: 180, h: 236, t: '🔒 Data a', cidr: '10.0.20.0/24', az: 'a', nacl: 'nacl-data', rt: 'rt-data', k: 'data',
    what: 'Database and cache of AZ a. Its route table has no internet line at all: no way in, no way out.' },
  'pub-b': { x: 520, y: 392, w: 180, h: 232, t: '🟢 Public b', cidr: '10.0.1.0/24', az: 'b', nacl: 'nacl-pub', rt: 'rt-pub', k: 'pub',
    what: 'The same front door, copied into AZ b, so one AZ failing doesn\'t close the shop.' },
  'app-b': { x: 714, y: 392, w: 286, h: 232, t: '🔒 App b', cidr: '10.0.11.0/24', az: 'b', nacl: 'nacl-app', rt: 'rt-app-b', k: 'app',
    what: 'The same services, copied into AZ b. Its route table points to NAT b, never to NAT a.' },
  'data-b': { x: 1012, y: 392, w: 180, h: 232, t: '🔒 Data b', cidr: '10.0.21.0/24', az: 'b', nacl: 'nacl-data', rt: 'rt-data', k: 'data',
    what: 'The Aurora reader (the standby writer) and the Redis replica live here.' },
}

// Boxes. k = colour family. sg = its Security Group. in = the subnet it sits in (for NACL/route badges).
// what = inspector text, aws = the service name, ana = the campus analogy used on the whole page.
const NODES = {
  user: { x: 25, y: 58, w: 160, h: 64, t: '📱 Riya\'s phone', s: 'ShopKart app · Mumbai', k: 'ext',
    what: 'Riya\'s phone runs the ShopKart app. It knows only a name: <code>api.shopkart.in</code>.' },
  bad: { x: 25, y: 320, w: 160, h: 64, t: '👾 Attacker', s: 'anyone online', k: 'bad',
    what: 'Anyone on the internet. Plays the 👾 trace.' },
  stripe: { x: 25, y: 548, w: 160, h: 64, t: '💳 Stripe', s: 'api.stripe.com', k: 'ext',
    what: 'A payment company on the public internet. You call it out through NAT; it calls you back with webhooks.' },
  r53: { x: 225, y: 58, w: 160, h: 64, t: '🧭 Route 53', s: 'public DNS', k: 'edge', aws: 'Route 53',
    what: 'AWS\'s DNS. The public hosted zone answers <code>api.shopkart.in</code> with CloudFront (an alias record). A private hosted zone gives names like <code>payment.internal</code> that only the VPC can see.',
    ana: 'The city phone book.' },
  cf: { x: 225, y: 297, w: 160, h: 110, t: '🌐 CloudFront', s: 'WAF + Shield · Mumbai edge', k: 'edge', waf: 'waf', aws: 'CloudFront · AWS WAF · Shield',
    what: 'AWS\'s edge network. Ends TLS close to the user, runs the WAF rules, and Shield soaks up floods. API calls go on to the ALB (POSTs are never cached).',
    ana: 'A kiosk in every neighbourhood, with a bag check at the door.' },
  igw: { x: 452, y: 322, w: 92, h: 60, t: '🚪 IGW', s: 'Internet Gateway', k: 'gw', aws: 'Internet Gateway',
    what: 'The VPC\'s only door to the internet. Swaps a box\'s public IP for its private one, 1:1. Has no rules of its own: the NACLs and Security Groups behind it do the checking.',
    ana: 'The campus main gate.' },
  alb: { x: 556, y: 316, w: 148, h: 72, t: '⚖️ ALB', s: 'a node in each public subnet', k: 'lb', sg: 'sg-alb', in: ['pub-a', 'pub-b'], aws: 'Application Load Balancer',
    what: 'Internet-facing Application Load Balancer, one node per AZ (10.0.0.10, 10.0.1.10). Ends TLS with an ACM certificate, routes by path (<code>/orders</code> → Order, <code>/webhooks/stripe</code> → Payment) and skips targets that fail <code>/health</code>.',
    ana: 'The receptionist who sends each visitor to the right office.' },
  'nat-a': { x: 534, y: 142, w: 152, h: 58, t: '🔁 NAT Gateway a', s: '10.0.0.20 · EIP 3.110.20.5', k: 'gw', in: ['pub-a'], aws: 'NAT Gateway',
    what: 'Lets private boxes in AZ a call out (Stripe) using its Elastic IP. Replies come back; new connections from outside are dropped. Has <b>no Security Group</b>: only the NACL guards it. Billed per hour and per GB.',
    ana: 'Reception running errands for badge-only staff.' },
  'nat-b': { x: 534, y: 458, w: 152, h: 58, t: '🔁 NAT Gateway b', s: '10.0.1.20 · EIP 3.110.20.6', k: 'gw', in: ['pub-b'], aws: 'NAT Gateway',
    what: 'AZ b\'s own NAT. If AZ a dies, AZ b still reaches Stripe through this one.',
    ana: 'The second building\'s own reception.' },
  'pay-a': { x: 724, y: 142, w: 126, h: 58, t: '💳 Payment', s: '10.0.10.40', k: 'app', sg: 'sg-pay', in: ['app-a'], aws: 'ECS Fargate task',
    what: 'Payment service. The only box that holds the Stripe key and talks to Stripe.' },
  'order-a': { x: 866, y: 142, w: 126, h: 58, t: '🛒 Order', s: '10.0.10.23', k: 'app', sg: 'sg-order', in: ['app-a'], aws: 'ECS Fargate task',
    what: 'Order service. Checks the idempotency key, saves the order, asks Payment to charge, publishes <code>OrderPlaced</code>.' },
  'work-a': { x: 724, y: 212, w: 126, h: 58, t: '⚙️ Worker', s: '10.0.10.55', k: 'app', sg: 'sg-work', in: ['app-a'], aws: 'ECS Fargate task',
    what: 'Background worker: pulls jobs from SQS (invoice, email). Nothing calls it, so its Security Group has no inbound rules at all.' },
  'vpce-a': { x: 866, y: 212, w: 126, h: 58, t: '🔌 Endpoints', s: '10.0.10.80', k: 'vpce', sg: 'sg-vpce', in: ['app-a'], aws: 'Interface VPC endpoints (PrivateLink)',
    what: 'Interface endpoints: a private IP in your subnet for SQS and Secrets Manager. With private DNS on, the normal names (<code>sqs.ap-south-1.amazonaws.com</code>) resolve to this IP, so code doesn\'t change. Billed per hour and per GB: cheaper than NAT, and never on the internet.',
    ana: 'An internal phone line to another company\'s office.' },
  'pay-b': { x: 724, y: 458, w: 126, h: 58, t: '💳 Payment', s: '10.0.11.40', k: 'app', sg: 'sg-pay', in: ['app-b'], aws: 'ECS Fargate task',
    what: 'The same Payment service, a second copy in AZ b.' },
  'order-b': { x: 866, y: 458, w: 126, h: 58, t: '🛒 Order', s: '10.0.11.23', k: 'app', sg: 'sg-order', in: ['app-b'], aws: 'ECS Fargate task',
    what: 'The same Order service, a second copy in AZ b.' },
  'work-b': { x: 724, y: 528, w: 126, h: 58, t: '⚙️ Worker', s: '10.0.11.55', k: 'app', sg: 'sg-work', in: ['app-b'], aws: 'ECS Fargate task',
    what: 'The same worker, a second copy in AZ b.' },
  'vpce-b': { x: 866, y: 528, w: 126, h: 58, t: '🔌 Endpoints', s: '10.0.11.80', k: 'vpce', sg: 'sg-vpce', in: ['app-b'], aws: 'Interface VPC endpoints (PrivateLink)',
    what: 'Each endpoint has a private IP in every AZ you pick, so AZ b keeps its own.' },
  'aur-w': { x: 1024, y: 142, w: 156, h: 58, t: '🐘 Aurora writer', s: '10.0.20.10 · :5432', k: 'data', sg: 'sg-db', in: ['data-a'], aws: 'Aurora PostgreSQL',
    what: 'Every write goes here. Aurora\'s storage keeps 6 copies across 3 AZs, so the data survives even when this server doesn\'t.' },
  'redis-a': { x: 1024, y: 212, w: 156, h: 58, t: '⚡ Redis primary', s: '10.0.20.30 · :6379', k: 'data', sg: 'sg-redis', in: ['data-a'], aws: 'ElastiCache for Redis',
    what: 'Idempotency keys and carts. Primary in AZ a, replica in AZ b, automatic failover (Multi-AZ).' },
  'aur-r': { x: 1024, y: 458, w: 156, h: 58, t: '🐘 Aurora reader', s: '10.0.21.10 · standby', k: 'data', sg: 'sg-db', in: ['data-b'], aws: 'Aurora PostgreSQL',
    what: 'Serves reads, and is the standby: if the writer dies, this one is promoted.' },
  'redis-b': { x: 1024, y: 528, w: 156, h: 58, t: '⚡ Redis replica', s: '10.0.21.30', k: 'data', sg: 'sg-redis', in: ['data-b'], aws: 'ElastiCache for Redis',
    what: 'A copy of the primary, a moment behind. Promoted if AZ a fails.' },
  'gw-s3': { x: 1143, y: 324, w: 118, h: 56, t: '🛤️ S3 endpoint', s: 'Gateway: a route', k: 'vpce', aws: 'Gateway VPC endpoint',
    what: 'Not a box at all: one route-table line, <code>pl-s3 → vpce-s3</code>. Free. Exists only for S3 and DynamoDB.',
    ana: 'A private corridor to the warehouse next door.' },
  secrets: { x: 1274, y: 140, w: 138, h: 64, t: '🔑 Secrets Manager', s: 'Stripe API key', k: 'svc', aws: 'Secrets Manager',
    what: 'Stores the Stripe key, encrypted with KMS. Only the Payment service\'s IAM role may read it.' },
  sqs: { x: 1274, y: 226, w: 138, h: 64, t: '📨 SQS', s: 'order-events queue', k: 'svc', aws: 'SQS',
    what: 'Holds <code>OrderPlaced</code> jobs until a worker finishes them. A message a worker crashes on comes back for another try.' },
  s3: { x: 1274, y: 420, w: 138, h: 64, t: '🪣 S3', s: 'invoices bucket', k: 'svc', aws: 'S3',
    what: 'Private bucket for invoice PDFs. Users download with short-lived pre-signed URLs.' },
}

// Security Groups: allow-only, and stateful (a reply to a call you made comes back with no rule).
// in rows: [port, from, why]. Sources are other groups, so a new task gets access by joining a group.
const SG = {
  'sg-alb': { on: 'the ALB', in: [['443', 'CloudFront\'s address list (managed prefix list)', 'only CloudFront may reach the ALB']] },
  'sg-order': { on: 'the Order service', in: [['8080', 'sg-alb', 'requests from the ALB']] },
  'sg-pay': { on: 'the Payment service', in: [['8080', 'sg-order', 'charge calls'], ['8080', 'sg-alb', 'Stripe webhooks (/webhooks/stripe)']] },
  'sg-work': { on: 'the Worker', in: [] },
  'sg-db': { on: 'Aurora', in: [['5432', 'sg-order', 'orders'], ['5432', 'sg-pay', 'payments'], ['5432', 'sg-work', 'invoice data']] },
  'sg-redis': { on: 'Redis', in: [['6379', 'sg-order', 'idempotency keys, carts']] },
  'sg-vpce': { on: 'the Interface endpoints', in: [['443', 'sg-order, sg-pay, sg-work', 'AWS API calls']] },
}

// Network ACLs: one per subnet type. Stateless (replies need their own rule), ordered, first match wins.
// Rows: [rule #, ports, from (in) / to (out), ALLOW|DENY, why]. The last row is always the * deny.
const EPH = 'TCP 1024–65535'
const NACL = {
  'nacl-pub': { on: 'both public subnets',
    in: [[100, 'TCP 443', '0.0.0.0/0', 'ALLOW', 'HTTPS to the ALB; app → NAT calls'], [110, EPH, '0.0.0.0/0', 'ALLOW', 'replies: Stripe → NAT, services → ALB'], ['*', 'all', '0.0.0.0/0', 'DENY', 'everything else']],
    out: [[100, 'TCP 8080', '10.0.0.0/16', 'ALLOW', 'ALB → services'], [110, 'TCP 443', '0.0.0.0/0', 'ALLOW', 'NAT → Stripe'], [120, EPH, '0.0.0.0/0', 'ALLOW', 'replies to users and CloudFront'], ['*', 'all', '0.0.0.0/0', 'DENY', 'everything else']] },
  'nacl-app': { on: 'both app subnets',
    in: [[100, 'TCP 8080', '10.0.0.0/16', 'ALLOW', 'ALB → services, service → service'], [110, EPH, '0.0.0.0/0', 'ALLOW', 'replies: DB, Redis, Stripe via NAT, AWS APIs'], ['*', 'all', '0.0.0.0/0', 'DENY', 'everything else']],
    out: [[100, 'TCP 443', '0.0.0.0/0', 'ALLOW', 'Stripe via NAT, S3, AWS APIs'], [110, 'TCP 5432, 6379', '10.0.20.0/23', 'ALLOW', 'to the database and cache'], [120, EPH, '10.0.0.0/16', 'ALLOW', 'replies to the ALB'], [130, 'TCP 8080', '10.0.0.0/16', 'ALLOW', 'service → service in the other AZ'], ['*', 'all', '0.0.0.0/0', 'DENY', 'everything else']] },
  'nacl-data': { on: 'both data subnets',
    in: [[100, 'TCP 5432, 6379', '10.0.10.0/23', 'ALLOW', 'only the two app subnets'], ['*', 'all', '0.0.0.0/0', 'DENY', 'everything else, e.g. the public subnets']],
    out: [[100, EPH, '10.0.10.0/23', 'ALLOW', 'replies to the app subnets'], ['*', 'all', '0.0.0.0/0', 'DENY', 'everything else']] },
}

// Route tables: the most specific matching line wins. Rows: [destination, target].
const RT = {
  'rt-pub': { on: 'both public subnets', rows: [['10.0.0.0/16', 'local (inside the VPC)'], ['0.0.0.0/0', '🚪 igw · Internet Gateway']] },
  'rt-app-a': { on: 'app subnet a', rows: [['10.0.0.0/16', 'local (inside the VPC)'], ['pl-s3 (S3\'s address list)', '🛤️ vpce-s3 · Gateway endpoint'], ['0.0.0.0/0', '🔁 nat-a · NAT Gateway in AZ a']] },
  'rt-app-b': { on: 'app subnet b', rows: [['10.0.0.0/16', 'local (inside the VPC)'], ['pl-s3 (S3\'s address list)', '🛤️ vpce-s3 · Gateway endpoint'], ['0.0.0.0/0', '🔁 nat-b · NAT Gateway in AZ b']] },
  'rt-data': { on: 'both data subnets', rows: [['10.0.0.0/16', 'local (inside the VPC)']], note: 'No 0.0.0.0/0 line: nothing here can reach the internet, and nothing on the internet has a road in.' },
}

// AWS WAF on CloudFront: rules in order, first match wins. Rows: [rule, matches, action].
const WAF = {
  waf: { on: 'CloudFront', rows: [['Rate limit', 'over 1,000 requests in 5 min from one IP', 'BLOCK'], ['AWS managed: SQL injection', '<code>\' OR 1=1 --</code> and friends', 'BLOCK'], ['AWS managed: known bad inputs', 'e.g. Log4j probes', 'BLOCK'], ['Default', 'everything else', 'ALLOW']] },
}

// Traces. A step: p = path (node ids, or [x, y] waypoints that keep lines off other boxes) or at = one node,
// m = the message on the packet, k = colour (dns, in, out, rep, async, bad), back = a reply (dashed),
// pk = the packet's addresses on this hop, x = blocked at the last box, c = checks [kind, id, dir/row, row, 'x'], dead = boxes that are down from now on,
// ren = new title + sub line for a box from now on, cap = the caption (headline first).
const V = { // waypoints: the gaps between boxes
  albUp: [858, 290], aUp: [858, 171], aGap: [858, 205], aGapR: [1006, 205], aLow: [1006, 290], svcLane: [1232, 290], toSecrets: [1232, 172], toSqs: [1232, 258],
  bTop: [858, 452], bTopR: [1006, 452], wrA: [1006, 171],
  over1: [205, 280], over2: [420, 280], uDown: [205, 90], uIn: [205, 352], lane1: [205, 120], lane2: [205, 662], lane3: [1343, 662],
}
const AZ_A = ['nat-a', 'pay-a', 'order-a', 'work-a', 'vpce-a', 'aur-w', 'redis-a']

const TRACES = [
  { id: 'order', t: '🛒 Place an order', intro: '🛒 <b>Riya taps "Pay ₹2,499".</b> The app sends <code>POST /orders</code> with an <code>Idempotency-Key</code>, so a retry can never charge her twice. Follow it through every AWS box: press ▶️ or Next.',
    steps: [
      { p: ['user', 'r53'], m: 'api.shopkart.in?', k: 'dns', cap: '🧭 <b>DNS first.</b> The phone asks Route 53 for <code>api.shopkart.in</code>.' },
      { p: ['r53', 'user'], back: 1, m: '→ CloudFront', k: 'dns', cap: '🧭 <b>Route 53 answers: "CloudFront"</b> (an alias record). CloudFront\'s own DNS then hands out the edge nearest to Riya: Mumbai. No VPC involved yet.' },
      { pk: 'Riya 203.0.113.7:52811 → CloudFront edge :443', p: ['user', V.uDown, V.uIn, 'cf'], m: 'POST /orders 🔒', k: 'in', c: [['waf', 'waf', 3]], cap: '🛡️ <b>The edge checks first.</b> TLS ends at the Mumbai edge, close to Riya, so the handshake is short. AWS WAF runs its rules in order; none match, so the default ALLOW wins ✅. Shield would soak up a flood.' },
      { pk: 'CloudFront\'s IP → ALB\'s public IP 203.0.113.80:443 · the IGW swaps it for 10.0.0.10', p: ['cf', 'igw', 'alb'], m: 'POST /orders', k: 'in', c: [['nacl', 'nacl-pub', 'in', 0], ['sg', 'sg-alb', 'in', 0]], cap: '🚪 <b>In through the only door.</b> CloudFront opens its own HTTPS connection to its origin, the ALB. The Internet Gateway swaps the ALB\'s public IP for its private one. Two checks: the public NACL (443 in ✅) and the ALB\'s Security Group (443 <b>from CloudFront only</b> ✅).' },
      { at: 'alb', m: '/orders* → Order', k: 'in', cap: '⚖️ <b>The ALB picks a healthy server.</b> Listener rule <code>/orders*</code> → the Order service\'s target group. It skips any task failing <code>/health</code>, and adds two headers: <code>X-Forwarded-For</code> (Riya\'s IP) and <code>X-Amzn-Trace-Id</code>, which every service logs, so one id finds this request in every log.' },
      { pk: '10.0.0.10 (the ALB, not Riya!) → 10.0.10.23:8080 · Riya\'s IP rides in X-Forwarded-For', p: ['alb', V.albUp, V.aUp, 'order-a'], m: '→ 10.0.10.23:8080', k: 'in', c: [['rt', 'rt-pub', 0], ['nacl', 'nacl-pub', 'out', 0], ['nacl', 'nacl-app', 'in', 0], ['sg', 'sg-order', 'in', 0]], cap: '🛒 <b>Into the private subnet.</b> The route is <code>local</code>: inside the VPC. Leaving the public subnet, NACL out ✅. Entering the app subnet, NACL in ✅. The Order service\'s Security Group allows 8080 <b>only from the ALB\'s group</b> ✅.' },
      { p: ['order-a', 'redis-a'], m: 'SET idem:key NX', k: 'in', c: [['nacl', 'nacl-app', 'out', 1], ['nacl', 'nacl-data', 'in', 0], ['sg', 'sg-redis', 'in', 0]], cap: '🔑 <b>"Have I seen this request before?"</b> Store the Idempotency-Key only if it\'s new (<code>SET … NX</code>). It\'s new ✅, so carry on. A retry with the same key would get the first answer back.' },
      { p: ['order-a', 'aur-w'], m: 'INSERT order PENDING', k: 'in', c: [['nacl', 'nacl-data', 'in', 0], ['sg', 'sg-db', 'in', 0]], cap: '🐘 <b>Save the order before charging.</b> One transaction: order <code>PENDING</code> + reserve the stock. Writes always go to the Aurora <b>writer</b>. The key is also a unique index here: a second guard if Redis forgets.' },
      { p: ['order-a', 'pay-a'], m: 'POST /charge', k: 'in', c: [['sg', 'sg-pay', 'in', 0]], cap: '💳 <b>Ask Payment to charge.</b> The name <code>payment.internal</code> comes from a Route 53 private zone. Same subnet, so <b>no NACL check</b>: a NACL guards only the subnet\'s border. The Security Group still checks: 8080 from the Order group ✅.' },
      { p: ['pay-a', 'vpce-a', V.aLow, V.svcLane, V.toSecrets, 'secrets'], m: 'GetSecretValue', k: 'in', c: [['rt', 'rt-app-a', 0], ['sg', 'sg-vpce', 'in', 0]], cap: '🔑 <b>Fetch the Stripe key, privately.</b> The Secrets Manager name resolves to the Interface endpoint\'s private IP, so the route is <code>local</code>: no NAT, no internet. The key stays cached in memory after this.' },
      { pk: '10.0.10.40:51514 → Stripe 198.51.100.20:443', p: ['pay-a', 'nat-a'], m: 'POST api.stripe.com', k: 'out', c: [['rt', 'rt-app-a', 2], ['nacl', 'nacl-app', 'out', 0], ['nacl', 'nacl-pub', 'in', 0]], cap: '🛣️ <b>Out to Stripe: the route table decides.</b> Stripe\'s IP isn\'t local and isn\'t S3, so only <code>0.0.0.0/0 → nat-a</code> matches: the NAT Gateway <b>in the same AZ</b>. Payment passes the order id as Stripe\'s Idempotency-Key, so a retry never charges twice.' },
      { pk: '3.110.20.5:40022 → 198.51.100.20:443 · NAT notes: 40022 = 10.0.10.40:51514', at: 'nat-a', m: '10.0.10.40 → 3.110.20.5', k: 'out', cap: '🔁 <b>NAT swaps the address.</b> Source <code>10.0.10.40:51514</code> becomes the Elastic IP <code>3.110.20.5</code> with a new port. A NAT Gateway has no Security Group: only the NACL guards it. Partners can allow-list this fixed IP.' },
      { p: ['nat-a', 'igw', 'stripe'], m: 'HTTPS → Stripe', k: 'out', c: [['rt', 'rt-pub', 1], ['nacl', 'nacl-pub', 'out', 1]], cap: '🚪 <b>Out through the same door.</b> The public route table sends <code>0.0.0.0/0 → igw</code>. Stripe sees <code>3.110.20.5</code>, never a private IP. ⏱️ Usually the slowest hop: a real trip over the internet to another company.' },
      { pk: '198.51.100.20:443 → 3.110.20.5:40022 → NAT looks it up → 10.0.10.40:51514', p: ['stripe', 'igw', 'nat-a', 'pay-a'], back: 1, m: '200 succeeded', k: 'rep', c: [['nacl', 'nacl-pub', 'in', 1], ['nacl', 'nacl-pub', 'out', 2], ['nacl', 'nacl-app', 'in', 1], ['sg', 'sg-pay', 'reply']], cap: '↩️ <b>The reply: where NACL and Security Group differ.</b> NACLs <b>forget</b> connections, so their 1024–65535 rules must let the reply in and out again ❗ Without it, Stripe charges the card and the answer dies on the way back. The Security Group <b>remembers</b> the call went out, so the reply walks in with no rule.' },
      { p: ['pay-a', V.aGap, V.aGapR, 'aur-w'], m: 'INSERT payment', k: 'in', c: [['sg', 'sg-db', 'in', 1]], cap: '🐘 <b>Record the payment</b> with Stripe\'s charge id, then answer the Order service: "paid".' },
      { p: ['order-a', 'aur-w'], m: 'UPDATE order PAID', k: 'in', c: [['sg', 'sg-db', 'in', 0]], cap: '📝 <b>Order → PAID.</b> In the same transaction, write an <b>outbox</b> row "OrderPlaced", so the event can\'t be lost if the next step fails.' },
      { p: ['order-a', 'vpce-a', V.aLow, V.svcLane, V.toSqs, 'sqs'], m: 'OrderPlaced', k: 'async', c: [['sg', 'sg-vpce', 'in', 0]], cap: '📨 <b>Hand off the slow work.</b> Publish <code>OrderPlaced</code> to SQS, through the endpoint again. Email, invoice and warehouse happen later, so Riya doesn\'t wait for them.' },
      { p: ['order-a', V.aUp, V.albUp, 'alb', 'igw', 'cf', V.uIn, V.uDown, 'user'], back: 1, m: '201 Created', k: 'rep', c: [['nacl', 'nacl-app', 'out', 2], ['nacl', 'nacl-pub', 'in', 1], ['nacl', 'nacl-pub', 'out', 2], ['sg', 'sg-order', 'reply']], cap: '✅ <b>201 Created, back the same way.</b> Order → ALB → Internet Gateway → CloudFront → phone. Every Security Group lets replies out by itself; every NACL needed its 1024–65535 rule.' },
      { end: 1, cap: '🧾 <b>One tap, four kinds of check.</b> 🛡️ WAF at the edge. 🛣️ Route tables pick each road. 🚧 NACLs guard each subnet\'s border and need reply rules. 🔐 Security Groups guard each box and remember replies. The database never had a road to the internet at all.' },
    ] },
  { id: 'hook', t: '🔔 Stripe calls back', intro: '🔔 <b>Stripe confirms the payment by calling you:</b> <code>POST /webhooks/stripe</code>. The Payment service has no public IP. So how does a call from the internet reach it?',
    steps: [
      { p: ['stripe', 'cf'], m: 'POST /webhooks/stripe', k: 'in', c: [['waf', 'waf', 3]], cap: '🌐 <b>Same front door as users.</b> Stripe resolves <code>api.shopkart.in</code> and lands on CloudFront. WAF checks it like any request ✅.' },
      { p: ['cf', 'igw', 'alb'], m: 'POST', k: 'in', c: [['nacl', 'nacl-pub', 'in', 0], ['sg', 'sg-alb', 'in', 0]], cap: '🚪 <b>Through the Internet Gateway to the ALB</b>: 443, from CloudFront only ✅.' },
      { at: 'alb', m: '/webhooks/stripe → Payment', k: 'in', cap: '⚖️ <b>A second listener rule:</b> <code>/webhooks/stripe</code> → the Payment target group. This one path is the <b>only</b> way the internet can reach the Payment service.' },
      { p: ['alb', 'pay-b'], m: '→ 10.0.11.40:8080', k: 'in', c: [['nacl', 'nacl-pub', 'out', 0], ['nacl', 'nacl-app', 'in', 0], ['sg', 'sg-pay', 'in', 1]], cap: '💳 <b>This time the ALB picks AZ b.</b> It spreads requests over healthy targets in both AZs. The Payment group lets in 8080 from the ALB group (its 2nd rule) ✅.' },
      { at: 'pay-b', m: '✍️ check Stripe-Signature', k: 'in', cap: '✍️ <b>Prove it\'s really Stripe.</b> Anyone can POST to this URL, and every network check above would pass. Only the app can tell: it checks the <code>Stripe-Signature</code> header with the webhook secret ✅.' },
      { p: ['pay-b', V.bTop, V.bTopR, V.wrA, 'aur-w'], m: 'UPDATE payment', k: 'in', c: [['nacl', 'nacl-app', 'out', 1], ['nacl', 'nacl-data', 'in', 0], ['sg', 'sg-db', 'in', 1]], cap: '🐘 <b>The write crosses AZs.</b> The writer lives in AZ a, so this hop crosses to another data centre: a little more latency, and AWS bills cross-AZ data. Stripe <b>retries for up to 3 days</b> until it gets a 2xx, so key the update by Stripe\'s event id: the same event twice changes nothing.' },
      { p: ['pay-b', 'alb', 'igw', 'cf', 'stripe'], back: 1, m: '200 OK', k: 'rep', c: [['sg', 'sg-pay', 'reply']], cap: '↩️ <b>200 OK back to Stripe</b>, so it stops retrying.' },
      { end: 1, cap: '🧠 <b>Network rules decide who can reach a box. Only the app can decide if a message is genuine.</b> Every public URL needs app checks too: signatures, idempotency.' },
    ] },
  { id: 's3', t: '🧾 Invoice via S3', intro: '🧾 <b>The <code>OrderPlaced</code> job waits in SQS.</b> A worker turns it into a PDF invoice. Watch S3 traffic skip the NAT Gateway, and the download skip your servers.',
    steps: [
      { p: ['work-a', 'vpce-a', V.aLow, V.svcLane, V.toSqs, 'sqs'], m: 'ReceiveMessage', k: 'async', c: [['sg', 'sg-vpce', 'in', 0]], cap: '📨 <b>The worker pulls the job.</b> Nothing calls the worker: it long-polls SQS through the endpoint. So its Security Group has <b>no inbound rules</b>.' },
      { p: ['sqs', V.toSqs, V.svcLane, V.aLow, 'vpce-a', 'work-a'], back: 1, m: 'OrderPlaced #8812', k: 'rep', c: [['sg', 'sg-work', 'reply']], cap: '📬 <b>The job arrives.</b> SQS hides it from other workers until this one deletes it. A crash means a retry, not a lost invoice.' },
      { p: ['work-a', V.albUp, V.aLow, 'gw-s3', 's3'], m: 'PutObject invoice.pdf', k: 'out', c: [['rt', 'rt-app-a', 1], ['nacl', 'nacl-app', 'out', 0]], cap: '🛤️ <b>The most specific route wins.</b> S3\'s address list matches <code>pl-s3 → vpce-s3</code>, which beats <code>0.0.0.0/0 → nat-a</code>. The PDF goes to S3 on AWS\'s own network: no NAT fee, no internet.' },
      { p: ['user', V.lane1, V.lane2, V.lane3, 's3'], m: 'GET pre-signed URL', k: 'in', cap: '📥 <b>Riya downloads it straight from S3.</b> The API gave her a <b>pre-signed URL</b> that works for a few minutes. The file never passes through your servers, and the bucket stays private.' },
      { end: 1, cap: '🧠 <b>S3 traffic skips NAT</b> (a Gateway endpoint, free) and <b>big files skip your servers</b> (pre-signed URLs). Both cut cost and load.' },
    ] },
  { id: 'attack', t: '👾 Attacks blocked', intro: '👾 <b>Six attacks, each stopped by a different layer.</b> That\'s defence in depth: no single rule is trusted alone.',
    steps: [
      { p: ['bad', 'cf'], x: 1, m: '5,000 req/min', k: 'bad', c: [['waf', 'waf', 0, 'x']], cap: '🌊 <b>A flood → WAF.</b> One IP sends thousands of requests. The rate-based rule blocks it at the edge with 403s; the ALB never sees them.' },
      { p: ['bad', 'cf'], x: 1, m: '\' OR 1=1 --', k: 'bad', c: [['waf', 'waf', 1, 'x']], cap: '💉 <b>SQL injection → WAF.</b> The managed SQL-injection rule matches and blocks. Your code still uses parameterised queries: WAF is a fence, not the fix.' },
      { p: ['bad', V.over1, V.over2, 'igw', 'alb'], x: 1, m: 'skip CloudFront', k: 'bad', c: [['nacl', 'nacl-pub', 'in', 0], ['sg', 'sg-alb', 'in', -1, 'x']], cap: '🚪 <b>Skip CloudFront → the ALB\'s Security Group.</b> The attacker calls the ALB\'s own DNS name to dodge WAF. The NACL allows 443 from anywhere ✅, but the ALB group allows only CloudFront: no rule matches, so the packet is silently dropped ❌.' },
      { pk: '198.51.100.66 → 10.0.20.10:5432 · a private address: no internet router carries it', p: ['bad', V.over1, V.over2, 'igw'], x: 1, m: '→ 10.0.20.10:5432', k: 'bad', c: [['rt', 'rt-data', -1, 'x']], cap: '🐘 <b>Straight at the database → no road.</b> <code>10.0.20.10</code> is a private IP: internet routers drop it, and the Internet Gateway only maps public IPs. The data subnet\'s route table has no internet line either way ❌.' },
      { p: ['pay-a', V.aGap, V.aGapR, 'redis-a'], x: 1, m: 'GET cart:*', k: 'bad', c: [['nacl', 'nacl-app', 'out', 1], ['nacl', 'nacl-data', 'in', 0], ['sg', 'sg-redis', 'in', -1, 'x']], cap: '🕵️ <b>A hacked service moves sideways → Security Group.</b> Say a bug lets someone run code in Payment. They try the cart cache. The data NACL allows the whole app subnet ✅, but Redis allows only the <b>Order</b> group ❌. Least privilege keeps the damage small.' },
      { p: ['bad', 'cf', 'igw', 'alb', 'pay-b'], x: 1, m: 'fake "paid" webhook', k: 'bad', c: [['waf', 'waf', 3], ['sg', 'sg-pay', 'in', 1]], cap: '✍️ <b>A forged webhook → the app.</b> A fake "payment succeeded" to the public webhook URL passes every network layer ✅, because it IS a valid public path. The signature check fails → <code>400</code> ❌. Some attacks only the app can stop.' },
      { end: 1, cap: '🧅 <b>Layers, outside in:</b> WAF (bad requests) → ALB Security Group (CloudFront only) → no route (private IPs) → NACL (a coarse subnet fence) → a Security Group per service (least privilege) → app checks (signatures, auth).' },
    ] },
  { id: 'az', t: '💥 AZ a goes down', intro: '💥 <b>Power fails in Availability Zone a.</b> Half the servers, the database writer, the Redis primary and NAT a are gone. Watch the design heal itself.',
    steps: [
      { at: 'aur-w', dead: AZ_A, m: '💥 AZ a down', k: 'bad', cap: '💥 <b>AZ a is down.</b> Its tasks, NAT a, the Aurora writer and the Redis primary all stop. Route 53, CloudFront, the ALB and S3 run across AZs, so they live on.' },
      { at: 'alb', m: 'health checks fail in a', k: 'in', cap: '⚖️ <b>The ALB stops sending to AZ a.</b> Health checks fail, those targets turn unhealthy, and new requests go only to AZ b. ECS starts replacement tasks there.' },
      { at: 'aur-r', ren: { 'aur-r': ['🐘 Aurora writer', '10.0.21.10 · promoted'] }, m: 'promoted to writer', k: 'rep', cap: '🐘 <b>Aurora fails over.</b> The reader in AZ b is promoted to writer, usually in about 30 seconds. The <b>cluster endpoint</b> (a DNS name) now points to it, so apps reconnect with no config change. Writes in that window fail; retries with the same Idempotency-Key make that safe.' },
      { at: 'redis-b', ren: { 'redis-b': ['⚡ Redis primary', '10.0.21.30 · promoted'] }, m: 'promoted', k: 'rep', cap: '⚡ <b>Redis promotes its replica</b> (Multi-AZ). Keys written in the last moment can be lost. That\'s why the idempotency key is also a unique index in Aurora.' },
      { p: ['user', V.uDown, V.uIn, 'cf', 'igw', 'alb', 'order-b'], m: 'POST /orders', k: 'in', c: [['sg', 'sg-order', 'in', 0]], cap: '🛒 <b>Riya orders again, all in AZ b.</b> Same front door, same ALB; it can only pick <code>order-b</code>.' },
      { p: ['order-b', 'aur-r'], m: 'INSERT order', k: 'in', c: [['sg', 'sg-db', 'in', 0]], cap: '🐘 <b>The order goes to the new writer</b>, in AZ b.' },
      { p: ['order-b', 'pay-b'], m: 'POST /charge', k: 'in', c: [['sg', 'sg-pay', 'in', 0]], cap: '💳 <b>Payment in AZ b takes the charge.</b>' },
      { p: ['pay-b', 'nat-b', 'igw', 'stripe'], m: 'POST api.stripe.com', k: 'out', c: [['rt', 'rt-app-b', 2], ['rt', 'rt-pub', 1]], cap: '🔁 <b>One NAT per AZ pays off.</b> AZ b\'s route table points to <code>nat-b</code>. If both AZs had shared NAT a, every payment would fail right now.' },
      { p: ['stripe', 'igw', 'nat-b', 'pay-b', 'order-b', 'alb', 'igw', 'cf', V.uIn, V.uDown, 'user'], back: 1, m: '201 Created', k: 'rep', cap: '✅ <b>Paid, and 201 back to Riya</b>, with half the region gone.' },
      { end: 1, cap: '🧠 <b>Survive an AZ by design:</b> every tier in 2+ AZs, one NAT per AZ, a standby database ready to promote, and spare room. AZ b now carries all the traffic, so run each AZ at about half load, or scale out fast.' },
    ] },
]

const AWSMAP = { MAP, ZONES, SUBNETS, NODES, SG, NACL, RT, WAF, TRACES }
if (typeof module !== 'undefined' && module.exports) module.exports = AWSMAP
root.AWSMAP = AWSMAP
if (typeof document === 'undefined') return

// ───────────────────────── engine ─────────────────────────
const SVGNS = 'http://www.w3.org/2000/svg'
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e }
const center = n => [n.x + n.w / 2, n.y + n.h / 2]
const pt = p => Array.isArray(p) ? p : center(NODES[p])
const inSub = (n, s) => { const c = center(n); return c[0] > s.x && c[0] < s.x + s.w && c[1] > s.y && c[1] < s.y + s.h }

// Where the line from a box's centre towards (tx, ty) leaves the box, plus a small gap
function edge(n, tx, ty) {
  const [cx, cy] = center(n), dx = tx - cx, dy = ty - cy
  if (!dx && !dy) return [cx, cy]
  const sx = dx ? (n.w / 2 + 4) / Math.abs(dx) : Infinity, sy = dy ? (n.h / 2 + 4) / Math.abs(dy) : Infinity
  const s = Math.min(sx, sy, 1)
  return [cx + dx * s, cy + dy * s]
}
// A step's path as points: boxes are clipped at their border, waypoints are used as they are
function points(path) {
  return path.map((p, i) => {
    if (Array.isArray(p)) return p
    const n = NODES[p], nb = path[i + 1] ?? path[i - 1]
    if (path.length === 1 || nb == null) return center(n)
    // Clip towards the neighbour on the side we travel: next for the first point, previous for the last
    if (i === 0) { const t = pt(path[1]); return edge(n, t[0], t[1]) }
    if (i === path.length - 1) { const t = pt(path[i - 1]); return edge(n, t[0], t[1]) }
    return center(n) // a box in the middle of a path: the line passes through its centre
  })
}
const d = pts => 'M' + pts.map(p => p.map(v => Math.round(v)).join(' ')).join(' L')

function mount(root) {
  if (root.dataset.ready) return
  root.dataset.ready = '1'
  const $ = s => root.querySelector(s)
  const vp = $('.am-vp'), cv = h('div', 'am-cv')
  cv.style.width = MAP.W + 'px'; cv.style.height = MAP.H + 'px'
  vp.appendChild(cv)

  // Zones and subnets
  ZONES.forEach(z => {
    const e = h('div', 'am-z am-' + z.k, `<span class="am-zt">${z.t}</span>`)
    Object.assign(e.style, { left: z.x + 'px', top: z.y + 'px', width: z.w + 'px', height: z.h + 'px' })
    e.dataset.z = z.id
    cv.appendChild(e)
  })
  const subEls = {}
  Object.entries(SUBNETS).forEach(([id, s]) => {
    const e = h('div', 'am-sub am-' + s.k)
    Object.assign(e.style, { left: s.x + 'px', top: s.y + 'px', width: s.w + 'px', height: s.h + 'px' })
    e.innerHTML = `<button type="button" class="am-st" data-sub="${id}"><b>${s.t}</b> <small>${s.cidr}</small></button>` +
      `<div class="am-badges"><button type="button" class="am-bd" data-nacl="${s.nacl}">🚧 ${s.nacl}</button><button type="button" class="am-bd" data-rt="${s.rt}">🛣️ ${s.rt}</button></div>`
    e.dataset.sub = id
    cv.appendChild(e); subEls[id] = e
  })
  // A small key inside the map, in the Internet column's free space, so the badges explain themselves
  const key = h('div', 'am-legend', '<b>🔑 How to read it</b><div>🔐 Security Group · a box</div><div>🚧 NACL · a subnet\'s border</div><div>🛣️ Route table · a subnet</div><div><span class="am-bd am-ok">passed</span> <span class="am-bd am-no">blocked</span></div><div><i class="am-kl"></i> request <i class="am-kl back"></i> reply</div>')
  Object.assign(key.style, { left: '20px', top: '134px', width: '170px' })
  cv.appendChild(key)
  // Lines sit under the boxes (so they never cover text); the packet and its label sit on top
  const svg = document.createElementNS(SVGNS, 'svg')
  svg.setAttribute('class', 'am-svg'); svg.setAttribute('viewBox', `0 0 ${MAP.W} ${MAP.H}`)
  svg.setAttribute('width', MAP.W); svg.setAttribute('height', MAP.H)
  svg.innerHTML = '<defs>' + ['dns', 'in', 'out', 'rep', 'async', 'bad'].map(k =>
    `<marker id="am-ar-${k}" class="am-k-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z"/></marker>`).join('') + '</defs><g class="am-old"></g><g class="am-now"></g>'
  cv.appendChild(svg)
  const nodeEls = {}
  Object.entries(NODES).forEach(([id, n]) => {
    const e = h('button', 'am-n am-' + n.k)
    e.type = 'button'; e.dataset.node = id
    Object.assign(e.style, { left: n.x + 'px', top: n.y + 'px', width: n.w + 'px', height: n.h + 'px' })
    e.innerHTML = `<b class="am-nt">${n.t}</b><small class="am-ns">${n.s}</small>` + (n.sg ? `<span class="am-sg" data-sg="${n.sg}">🔐 ${n.sg}</span>` : '') + (n.waf ? '<span class="am-sg" data-waf="waf">🛡️ WAF</span>' : '')
    cv.appendChild(e); nodeEls[id] = e
  })
  const top = document.createElementNS(SVGNS, 'svg')
  top.setAttribute('class', 'am-svg am-top'); top.setAttribute('viewBox', `0 0 ${MAP.W} ${MAP.H}`)
  top.setAttribute('width', MAP.W); top.setAttribute('height', MAP.H)
  top.innerHTML = '<circle class="am-dot" r="9" cx="-50" cy="-50"/><text class="am-x" x="-50" y="-50">✕</text>'
  cv.appendChild(top)
  const dot = top.querySelector('.am-dot'), xMark = top.querySelector('.am-x')
  const msg = h('div', 'am-msg'); msg.hidden = true; cv.appendChild(msg)

  // ── camera: pan, zoom, fit, follow ──
  const cam = { s: 1, x: 0, y: 0 }
  const apply = () => { cv.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.s})` }
  const fitS = () => Math.min(vp.clientWidth / MAP.W, vp.clientHeight / MAP.H)
  const clampS = s => Math.max(fitS() * 0.8, Math.min(2.5, s))
  function look(box, smooth = true, pad = 40) { // fit a box (map coords) in the view
    const s = clampS(Math.min(vp.clientWidth / (box.w + pad * 2), vp.clientHeight / (box.h + pad * 2)))
    cam.s = s
    cam.x = vp.clientWidth / 2 - (box.x + box.w / 2) * s
    cam.y = vp.clientHeight / 2 - (box.y + box.h / 2) * s
    vp.classList.toggle('am-smooth', smooth && !reduce()); apply()
  }
  const fit = (smooth = true) => look({ x: 0, y: 0, w: MAP.W, h: MAP.H }, smooth, 0)
  function zoomAt(f, px, py) { // zoom by f around a point in viewport pixels
    const s = clampS(cam.s * f), k = s / cam.s
    cam.x = px - (px - cam.x) * k; cam.y = py - (py - cam.y) * k; cam.s = s
    apply()
  }
  // CSS zoom on the page scales client pixels; convert them to layout pixels
  const zf = () => (vp.getBoundingClientRect().width / vp.offsetWidth) || 1
  const local = e => { const r = vp.getBoundingClientRect(), z = zf(); return [(e.clientX - r.left) / z, (e.clientY - r.top) / z] }
  vp.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return // a plain wheel scrolls the page; pinch or ⌘/Ctrl + wheel zooms
    e.preventDefault(); vp.classList.remove('am-smooth')
    const [px, py] = local(e); zoomAt(Math.exp(-e.deltaY * 0.0025), px, py)
  }, { passive: false })
  const ptrs = new Map(); let drag = null, moved = false
  vp.addEventListener('pointerdown', e => {
    ptrs.set(e.pointerId, local(e)); moved = false
    vp.classList.remove('am-smooth')
    if (ptrs.size === 1) drag = { p: local(e), x: cam.x, y: cam.y }
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; drag = { pinch: Math.hypot(a[0] - b[0], a[1] - b[1]), s: cam.s } }
  })
  vp.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId) || !drag) return
    ptrs.set(e.pointerId, local(e))
    if (ptrs.size === 2 && drag.pinch) {
      const [a, b] = [...ptrs.values()], dist = Math.hypot(a[0] - b[0], a[1] - b[1])
      zoomAt(drag.s * dist / drag.pinch / cam.s, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); moved = true; return
    }
    const p = local(e), dx = p[0] - drag.p[0], dy = p[1] - drag.p[1]
    if (!moved && Math.hypot(dx, dy) < 5) return
    if (!moved) { moved = true; try { vp.setPointerCapture(e.pointerId) } catch (err) {} }
    cam.x = drag.x + dx; cam.y = drag.y + dy; vp.classList.add('am-drag'); apply()
  })
  const up = e => { ptrs.delete(e.pointerId); if (!ptrs.size) { drag = null; vp.classList.remove('am-drag') } else if (ptrs.size === 1) { const p = [...ptrs.values()][0]; drag = { p, x: cam.x, y: cam.y } } }
  vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', up)
  vp.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false } }, true)

  // ── inspector ──
  const insp = $('.am-insp')
  const tbl = (head, rows, mark) => '<table class="am-t"><thead><tr>' + head.map(x => `<th>${x}</th>`).join('') + '</tr></thead><tbody>' +
    rows.map((r, i) => `<tr class="${mark && mark[i] ? mark[i] : ''}">` + r.map(x => `<td>${x}</td>`).join('') + '</tr>').join('') + '</tbody></table>'
  function sgCard(id, row, bad) {
    const g = SG[id]
    const top = `<div class="am-ch"><b>🔐 Security Group <code>${id}</code></b> on ${g.on} · inbound · allow rules only</div>`
    if (row === 'reply') return `<div class="am-card am-ok">${top}<p>🧠 <b>Stateful:</b> this is the reply to a connection that was allowed on the way out, so it passes with no rule.</p></div>`
    if (!g.in.length) return `<div class="am-card ${bad ? 'am-no' : ''}">${top}<p>No inbound rules: nothing can open a connection to it.</p></div>`
    const mark = g.in.map((_, i) => i === row ? (bad ? 'am-no' : 'am-ok') : '')
    return `<div class="am-card ${bad ? 'am-no' : 'am-ok'}">${top}${tbl(['Port', 'From', 'Why'], g.in.map(r => [r[0], r[1], r[2]]), mark)}` +
      (row === -1 ? '<p class="am-v am-no">❌ No rule matches, so the packet is dropped. No error is sent back: the caller just times out.</p>' : `<p class="am-v ${bad ? 'am-no' : 'am-ok'}">${bad ? '❌' : '✅'} Rule ${row + 1} matches.</p>`) + '</div>'
  }
  function naclCard(id, dir, row, bad) {
    const a = NACL[id], rows = a[dir], hit = row === -1 ? rows.length - 1 : row
    const mark = rows.map((_, i) => i === hit ? (bad || row === -1 ? 'am-no' : 'am-ok') : i < hit ? 'am-skip' : '')
    return `<div class="am-card ${bad ? 'am-no' : 'am-ok'}"><div class="am-ch"><b>🚧 Network ACL <code>${id}</code></b> on ${a.on} · ${dir === 'in' ? 'inbound' : 'outbound'} · lowest number first, first match wins</div>` +
      tbl(['#', 'Ports', dir === 'in' ? 'From' : 'To', 'Action'], rows.map(r => [r[0], r[1], r[2], `<b class="${r[3] === 'ALLOW' ? 'am-ok' : 'am-no'}">${r[3]}</b> <small>${r[4]}</small>`]), mark) + '</div>'
  }
  function rtCard(id, row, bad) {
    const r = RT[id]
    return `<div class="am-card ${bad ? 'am-no' : 'am-ok'}"><div class="am-ch"><b>🛣️ Route table <code>${id}</code></b> on ${r.on} · the most specific matching line wins</div>` +
      tbl(['Destination', 'Goes to'], r.rows, r.rows.map((_, i) => i === row ? 'am-ok' : '')) +
      (row === -1 ? '<p class="am-v am-no">❌ No line matches an internet address: there is no road between this subnet and the internet, in either direction.</p>' : r.note ? `<p class="am-v">${r.note}</p>` : '') + '</div>'
  }
  function wafCard(id, row, bad) {
    const w = WAF[id]
    return `<div class="am-card ${bad ? 'am-no' : 'am-ok'}"><div class="am-ch"><b>🛡️ AWS WAF</b> on ${w.on} · rules in order, first match wins</div>` +
      tbl(['Rule', 'Matches', 'Action'], w.rows.map(r => [r[0], r[1], `<b class="${r[2] === 'ALLOW' ? 'am-ok' : 'am-no'}">${r[2]}</b>`]), w.rows.map((_, i) => i === row ? (bad ? 'am-no' : 'am-ok') : i < row ? 'am-skip' : '')) + '</div>'
  }
  function checkCard(c) {
    const bad = c.includes('x')
    if (c[0] === 'sg') return sgCard(c[1], c[2] === 'reply' ? 'reply' : c[3], bad)
    if (c[0] === 'nacl') return naclCard(c[1], c[2], c[3], bad)
    if (c[0] === 'rt') return rtCard(c[1], c[2], bad)
    if (c[0] === 'waf') return wafCard(c[1], c[2], bad)
    return ''
  }
  // One-line summary of a check, shown as a chip under the caption (the full table is in the inspector)
  function chip(c) {
    const bad = c.includes('x'), v = bad ? '❌' : '✅'
    if (c[0] === 'sg') return `🔐 ${c[1]} · ${c[2] === 'reply' ? 'reply remembered' : c[3] === -1 ? 'no rule matches' : 'rule ' + (c[3] + 1)} ${v}`
    if (c[0] === 'nacl') { const r = c[3] === -1 ? NACL[c[1]][c[2]].at(-1) : NACL[c[1]][c[2]][c[3]]; return `🚧 ${c[1]} · ${c[2]} · rule ${r[0]} ${r[3]} ${c[3] === -1 ? '❌' : v}` }
    if (c[0] === 'rt') return `🛣️ ${c[1]} · ${c[2] === -1 ? 'no internet line' : RT[c[1]].rows[c[2]][0] + ' → ' + RT[c[1]].rows[c[2]][1].split(' · ')[0]} ${v}`
    if (c[0] === 'waf') return `🛡️ WAF · ${WAF[c[1]].rows[c[2]][0]} ${v}`
    return ''
  }
  const HINT = '<p class="am-hint">👆 Tap any box, subnet, 🚧 NACL or 🛣️ route badge to see its rules.</p>'
  function showChecks(step) {
    const cs = step.c || []
    insp.innerHTML = cs.length ? `<div class="am-ih">🔍 Checked on this step (${cs.length})</div><div class="am-cards">${cs.map(checkCard).join('')}</div>` : HINT
  }
  function showNode(id) {
    const n = NODES[id]
    let html = `<div class="am-ih">${n.t} <small>${n.s}</small>${n.aws ? ` <span class="aws">☁️ AWS: ${n.aws}</span>` : ''}</div><p>${n.what}</p>` + (n.ana ? `<p class="ana">🏢 ${n.ana}</p>` : '')
    const cards = []
    if (n.sg) cards.push(sgCard(n.sg, null))
    if (n.waf) cards.push(wafCard(n.waf, null))
    if (n.in) n.in.forEach(s => { cards.push(naclCard(SUBNETS[s].nacl, 'in', null)) })
    if (n.in && n.in.length === 1) cards.push(rtCard(SUBNETS[n.in[0]].rt, null))
    insp.innerHTML = html + (cards.length ? `<div class="am-cards">${[...new Set(cards)].join('')}</div>` : '')
  }
  function showSub(id) {
    const s = SUBNETS[id]
    insp.innerHTML = `<div class="am-ih">${s.t} <small>${s.cidr} · AZ ${s.az}</small></div><p>${s.what}</p><div class="am-cards">${naclCard(s.nacl, 'in', null)}${naclCard(s.nacl, 'out', null)}${rtCard(s.rt, null)}</div>`
  }
  cv.addEventListener('click', e => {
    const t = e.target.closest('[data-node], [data-sub], [data-nacl], [data-rt], [data-sg], [data-waf]')
    if (!t) return
    cv.querySelectorAll('.am-pick').forEach(x => x.classList.remove('am-pick'))
    if (t.dataset.nacl) insp.innerHTML = `<div class="am-cards">${naclCard(t.dataset.nacl, 'in', null)}${naclCard(t.dataset.nacl, 'out', null)}</div>`
    else if (t.dataset.rt) insp.innerHTML = `<div class="am-cards">${rtCard(t.dataset.rt, null)}</div>`
    else if (t.dataset.sub) showSub(t.dataset.sub)
    else if (t.dataset.node) showNode(t.dataset.node)
    ;(t.closest('.am-n, .am-sub') || t).classList.add('am-pick')
    insp.scrollIntoView({ block: 'nearest', behavior: reduce() ? 'auto' : 'smooth' })
  })

  // ── player ──
  const capEl = $('.am-cap'), cnt = $('.am-cnt'), dots = $('.am-dots'), playB = $('.am-play'), follow = $('.am-follow input')
  let tr = TRACES[0], i = 0, timer = null, anim = null
  const tabs = $('.am-tabs')
  TRACES.forEach(t => {
    const b = h('button', '', t.t); b.type = 'button'; b.dataset.tr = t.id
    b.onclick = () => { stop(); pick(t.id) }
    tabs.appendChild(b)
  })
  function pick(id) {
    tr = TRACES.find(t => t.id === id) || TRACES[0]; i = 0
    tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tr === tr.id))
    dots.innerHTML = ''
    for (let k = 0; k <= tr.steps.length; k++) {
      const b = h('button', '', k ? String(k) : '▶'); b.type = 'button'; b.title = k ? `Step ${k}` : 'Start'
      b.onclick = () => { stop(); go(k) }
      dots.appendChild(b)
    }
    go(0)
  }
  // Every box any step of this trace touches
  const used = t => new Set(t.steps.flatMap(s => [...(s.p || []).filter(p => !Array.isArray(p)), ...(s.at ? [s.at] : [])]))
  const nodesOf = s => [...(s.p || []).filter(p => !Array.isArray(p)), ...(s.at ? [s.at] : [])]
  function go(k) {
    i = Math.max(0, Math.min(tr.steps.length, k))
    const step = i ? tr.steps[i - 1] : null
    cancelAnimationFrame(anim)
    // State built up by earlier steps: dead boxes, renamed boxes, visited boxes
    const dead = new Set(), ren = {}, seen = new Set()
    for (let j = 0; j < i; j++) {
      const s = tr.steps[j]
      ;(s.dead || []).forEach(x => dead.add(x)); Object.assign(ren, s.ren || {})
      if (j < i - 1) nodesOf(s).forEach(x => seen.add(x))
    }
    const inTrace = used(tr), now = step ? nodesOf(step) : []
    Object.entries(nodeEls).forEach(([id, e]) => {
      const n = NODES[id], r = ren[id]
      e.querySelector('.am-nt').textContent = r ? r[0] : n.t
      e.querySelector('.am-ns').textContent = r ? r[1] : n.s
      e.classList.toggle('dim', !inTrace.has(id) && !dead.has(id))
      e.classList.toggle('dead', dead.has(id))
      e.classList.toggle('seen', seen.has(id))
      e.classList.toggle('on', now.includes(id))
      e.classList.toggle('blocked', !!(step && step.x && now[now.length - 1] === id))
    })
    cv.querySelectorAll('.am-az').forEach(z => z.classList.toggle('dead', z.dataset.z === 'az-a' && dead.has('aur-w')))
    // Badges: light the NACL / route table / Security Group / WAF this step checked, green or red
    cv.querySelectorAll('.am-bd, .am-sg').forEach(b => b.classList.remove('am-ok', 'am-no'))
    cv.querySelectorAll('.am-pick').forEach(x => x.classList.remove('am-pick'))
    ;(step && step.c || []).forEach(c => {
      const cls = c.includes('x') ? 'am-no' : 'am-ok'
      // Subnets this step touched. A box in two subnets (the ALB) counts in the AZ of the box it talks to.
      const single = now.flatMap(id => (NODES[id].in || []).length === 1 ? NODES[id].in : [])
      const azs = new Set(single.map(x => SUBNETS[x].az))
      const touched = now.flatMap(id => { const ins = NODES[id].in || []; return ins.length < 2 ? ins : ins.filter(x => !azs.size || azs.has(SUBNETS[x].az)) })
      if (c[0] === 'sg') now.forEach(id => { if (NODES[id].sg === c[1]) nodeEls[id].querySelector('.am-sg').classList.add(cls) })
      if (c[0] === 'waf') nodeEls.cf.querySelector('[data-waf]').classList.add(cls)
      if (c[0] === 'nacl' || c[0] === 'rt') {
        const attr = c[0] === 'nacl' ? 'data-nacl' : 'data-rt'
        let subs = touched.filter(s => SUBNETS[s][c[0]] === c[1])
        if (!subs.length) subs = Object.keys(SUBNETS).filter(s => SUBNETS[s][c[0]] === c[1]) // e.g. the data route table seen from outside
        subs.forEach(s => subEls[s].querySelector(`[${attr}="${c[1]}"]`).classList.add(cls))
      }
    })
    // Lines: earlier steps faint, this step bold
    const old = svg.querySelector('.am-old'), cur = svg.querySelector('.am-now')
    old.innerHTML = ''; cur.innerHTML = ''
    tr.steps.slice(0, Math.max(0, i - 1)).forEach(s => { if (s.p) old.appendChild(line(s, false)) })
    msg.hidden = true; dot.setAttribute('cx', -50); xMark.setAttribute('x', -50)
    dot.setAttribute('class', 'am-dot'); dot.setAttribute('r', 9)
    if (step && step.p) { const l = line(step, true); cur.appendChild(l); run(step, l) }
    else if (step && step.at) { const c = center(NODES[step.at]); label(step, c[0], NODES[step.at].y - 6) }
    capEl.innerHTML = (step ? step.cap : tr.intro) + (step && step.pk ? `<div class="am-pk">📦 ${step.pk}</div>` : '') +
      (step && step.c ? `<div class="am-chips">${step.c.map(c => `<button type="button" class="am-chip ${c.includes('x') ? 'am-no' : 'am-ok'}">${chip(c)}</button>`).join('')}</div>` : '')
    capEl.querySelectorAll('.am-chip').forEach(b => { b.onclick = () => insp.scrollIntoView({ block: 'start', behavior: reduce() ? 'auto' : 'smooth' }) })
    cnt.textContent = `${i} / ${tr.steps.length}`
    dots.querySelectorAll('button').forEach((b, k) => { b.classList.toggle('on', k === i); b.classList.toggle('done', k < i) })
    $('.am-prev').disabled = i === 0; $('.am-next').disabled = i === tr.steps.length
    if (step) showChecks(step); else insp.innerHTML = HINT
    // Camera: follow the packet, or show the whole map at the start and the end
    if (follow.checked && step && !step.end) {
      const ps = step.p ? points(step.p) : [], ns = nodesOf(step).map(id => NODES[id])
      const xs = [...ps.map(p => p[0]), ...ns.flatMap(n => [n.x, n.x + n.w])], ys = [...ps.map(p => p[1]), ...ns.flatMap(n => [n.y, n.y + n.h])]
      const x0 = Math.min(...xs), y0 = Math.min(...ys)
      look({ x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 }, true, 70)
    } else if (follow.checked) fit()
  }
  function line(step, now) {
    const p = document.createElementNS(SVGNS, 'path')
    p.setAttribute('d', d(points(step.p)))
    p.setAttribute('class', `am-l am-k-${step.k}${step.back ? ' back' : ''}${now ? ' now' : ''}`)
    if (now) p.setAttribute('marker-end', `url(#am-ar-${step.k})`)
    return p
  }
  function label(step, x, y) {
    msg.textContent = step.m || ''; msg.hidden = !step.m
    msg.className = 'am-msg am-k-' + step.k
    msg.style.left = x + 'px'; msg.style.top = y + 'px'
  }
  // Move the packet along the path; a blocked step ends on a red ✕
  function run(step, path) {
    const len = path.getTotalLength(), dur = reduce() ? 0 : Math.min(2600, 500 + len * 1.6)
    dot.setAttribute('class', 'am-dot am-k-' + step.k)
    const t0 = performance.now()
    const tick = t => {
      const f = dur ? Math.min(1, (t - t0) / dur) : 1, e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2
      const q = path.getPointAtLength(len * e)
      dot.setAttribute('cx', q.x); dot.setAttribute('cy', q.y)
      label(step, q.x, q.y - 14)
      if (f < 1) anim = requestAnimationFrame(tick)
      else {
        // Landed: park the label on the middle of the longest leg, so it doesn't cover the box it arrived at
        const ps = points(step.p); let best = 0, at = [q.x, q.y]
        for (let k = 1; k < ps.length; k++) { const l = Math.hypot(ps[k][0] - ps[k - 1][0], ps[k][1] - ps[k - 1][1]); if (l > best) { best = l; at = [(ps[k][0] + ps[k - 1][0]) / 2, (ps[k][1] + ps[k - 1][1]) / 2] } }
        // A short hop between neighbours has no free space for the label: hide it (the caption names the message)
        if (best < 90) msg.hidden = true
        else label(step, at[0], at[1] + 11)
        if (step.x) { xMark.setAttribute('x', q.x); xMark.setAttribute('y', q.y + 6); dot.setAttribute('r', 13); dot.setAttribute('class', 'am-dot am-k-bad') }
      }
    }
    anim = requestAnimationFrame(tick)
  }
  // ▶️ Play: next step after the packet lands plus reading time for the caption. Never starts by itself.
  function stop() { clearTimeout(timer); timer = null; playB.textContent = '▶️ Play'; playB.classList.remove('on') }
  function play() {
    if (i >= tr.steps.length) go(0)
    playB.textContent = '⏸️ Pause'; playB.classList.add('on')
    const tickPlay = () => {
      if (i >= tr.steps.length) return stop()
      go(i + 1)
      const words = (tr.steps[i - 1].cap.replace(/<[^>]+>/g, '').match(/\S+/g) || []).length
      timer = setTimeout(tickPlay, 1800 + words * 230)
    }
    tickPlay()
  }
  playB.onclick = () => timer ? stop() : play()
  $('.am-prev').onclick = () => { stop(); go(i - 1) }
  $('.am-next').onclick = () => { stop(); go(i + 1) }
  $('.am-restart').onclick = () => { stop(); go(0); fit() }
  $('.am-zin').onclick = () => { vp.classList.add('am-smooth'); zoomAt(1.3, vp.clientWidth / 2, vp.clientHeight / 2) }
  $('.am-zout').onclick = () => { vp.classList.add('am-smooth'); zoomAt(1 / 1.3, vp.clientWidth / 2, vp.clientHeight / 2) }
  $('.am-fit').onclick = () => fit()
  follow.onchange = () => { if (follow.checked) go(i); else fit() }
  root.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea')) return
    if (e.key === 'ArrowRight') { stop(); go(i + 1); e.preventDefault() }
    if (e.key === 'ArrowLeft') { stop(); go(i - 1); e.preventDefault() }
  })
  // Follow the packet by default only where the whole map would be too small to read
  follow.checked = fitS() < 0.6
  let lastW = vp.clientWidth
  new ResizeObserver(() => { if (vp.clientWidth && Math.abs(vp.clientWidth - lastW) > 2) { lastW = vp.clientWidth; follow.checked ? go(i) : fit(false) } }).observe(vp)
  pick(TRACES[0].id); fit(false)
  root.awsMap = { go: k => { stop(); go(k) }, pick: id => { stop(); pick(id) }, fit, look, cam }
  // Links in the notes below the map ("🛒 step 14") jump to that step
  ;(root.closest('section') || root).addEventListener('click', e => {
    const a = e.target.closest('[data-am]'); if (!a) return
    e.preventDefault(); stop()
    const [t, k] = a.dataset.am.split(':'); pick(t); go(+k)
    root.querySelector('.am-bar').scrollIntoView({ block: 'start', behavior: reduce() ? 'auto' : 'smooth' })
  })
}
AWSMAP.mount = mount
})(typeof window !== 'undefined' ? window : globalThis)
