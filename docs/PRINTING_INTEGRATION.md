# Brightdesk Printing in Pages

Brightdesk Pages uses the shared local-first adapter from the private
`Brightdesk-Printing` repository.

## Shared source

- Upstream: `conz20/Brightdesk-Printing`
- Mirrored source revision: `70d41095616c6d1cd3473c0ad73a6ecb5a596c05`
- Snapshot location: `src/printing-package/`
- Provenance: `src/printing-package/UPSTREAM.json`

The snapshot is bundled locally. Pages does not need a public package registry,
private Git access or an internet connection to list configured system queues
and open the operating system's print dialog.

## Printer workflow

Pages lists printers already configured by the operating system, offers
separate network discovery and printer-settings actions, and submits print
requests through Electron's visible operating-system print dialog. The user
must choose and approve any pairing, queue setup or driver installation.
Brightdesk does not silently add queues or install printer drivers.

A network discovery result is marked as discovered, not ready to print. Pages
only offers printing to a configured operating-system queue. Successful
submission means the operating system accepted the job; it does not prove that
a physical page was printed.

## Platform integration

- **macOS:** the bundled Bonjour helper is built with the Xcode Swift compiler
  by `npm run build:printing-native`. The installer unpacks the helper outside
  ASAR and declares the supported Bonjour service types and local-network
  permission text in Info.plist.
- **Windows:** the bundled WinDNS/WSD helper is built with the Windows SDK and
  Visual C++ Build Tools by `npm run build:printing-native`. The installer
  unpacks the helper outside ASAR. The native build must run on Windows with
  the required toolchain available.
- **Linux:** network discovery uses the host's CUPS `ippfind` utility for
  IPP/IPPS and legacy LPD services. Brightdesk does not bundle or install CUPS,
  `ippfind`, vendor packages or drivers. Configured queues remain available
  when `ippfind` is missing.

## Verification limits

The virtual-printer tests verify the shared adapter contract without attached
hardware. They do not prove that native discovery, queue configuration,
drivers, capabilities or physical printing work on a particular computer.

The updated Page branch still requires a fresh current-head CI run, a native
build on macOS and Windows, Linux CUPS integration verification, and real
printer acceptance testing on all three operating systems before merge.
