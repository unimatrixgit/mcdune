# DuneRealms Hetzner deployment topologies

> Live status, 18 October 2026: [Velocity plus the saved Guild lobby](live-lobby/README.md) run together on the EU Minecraft VM. The website and CloudPanel run separately. The seven-VM arrangement below is an earlier proposed topology, not the deployed layout. The custom lobby and Navigator structure now exist on beta and are installed; planet backends still need their own provisioned hosts and configuration.

## Current layout: seven virtual machines
- `dune-proxy-01`: Velocity, public Minecraft TCP 25565.
- `dune-lobby-01`: Spacing Guild Paper (25571) **plus CloudPanel website** (80, 443, 8443).
- `dune-arrakis-01`: Arrakis Paper, private TCP 25566.
- `dune-giedi-01`: Giedi Prime Paper, private TCP 25567.
- `dune-kaitain-01`: Kaitain Paper, private TCP 25568.
- `dune-caladan-01`: Caladan Paper, private TCP 25569.
- `dune-sigma-01`: Sigma Draconis IV Paper, private TCP 25570.

All seven VMs must join a Hetzner private network. Proxy reaches backend VM private IPs;
the backends are not exposed publicly. Limit SSH and CloudPanel 8443 to administrator IPs.
On the lobby VM, install CloudPanel **first** on fresh Debian, then Java 21.

## Alternative layout: one VM
Use `network/deploy-network.sh` for the all-in-one setup. Its default
backend addresses are loopback. Reserve enough RAM for six Paper instances and
Velocity; if CloudPanel is on that VM install CloudPanel before Minecraft.

## Per-VM deployment (current recommended mode)
1. Run `network/hetzner-debian-setup.sh` on each Debian 12/13 VM
   (CloudPanel first on the lobby VM).
2. Download the same `DuneRealms-Velocity-Network.zip` GitHub Actions artifact.
3. On each VM run:
   `sudo bash network/deploy-node.sh /path/to/DuneRealms-Velocity-Network.zip NODE PRIVATE_IP`
   with NODE one of `proxy`, `spacing-guild`, `arrakis`, `giedi-prime`,
   `kaitain`, `caladan`, `sigma-draconis-iv`.
4. Install the matching official Paper 1.21.4 or Velocity proxy JAR in the
   service working directory. The per-node script does not download server JARs.
5. Edit proxy `velocity.toml` to use backend private IPs instead of loopback.
   Copy the proxy forwarding secret into each backend's Paper proxy config.
   Do not expose backend ports to the internet.
6. Review/accept Minecraft EULA on each backend, then enable/start services
   using `sudo systemctl enable --now dune-NODE`.

The generated ZIP includes a *prototype* Spacing Guild terrain profile; the
custom lobby generation and navigator behavior are not yet implemented.
