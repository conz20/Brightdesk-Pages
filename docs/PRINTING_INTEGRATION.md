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

Pages lists configured operating-system queues and submits print requests through Electron's visible operating-system print dialog. The Print request carries the current Page Layout paper size and portrait/landscape orientation into the operating-system dialog. Printer settings opens the operating system's printer setup screen. The renderer exposes a customer-facing **Find network printers** panel and a configured-printer list. Opening the panel does not begin a search; the user explicitly chooses **Search local network**. Results use safe display names and protocol labels. On Windows, eligible WSD results offer a separate user-approved **Pair** action; other discovered devices direct the user to operating-system printer settings. A discovered device is not yet a usable print queue. Brightdesk refreshes the operating-system queue list and only submits print jobs to queues the operating system exposes. The configured-printer panel can show normalized colour, duplex, paper-size, resolution and copy capabilities; unknown values remain unknown. The visible operating-system print dialog remains responsible for final printer choice and options. Successful submission means the operating system accepted the job; it does not prove that a physical page was printed.

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
