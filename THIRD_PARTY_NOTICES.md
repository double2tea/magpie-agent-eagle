# Third-party notices

## Eagle application icon and name

`eagle/logo.png` and the PNG embedded in `package.json` are derived from the
official Eagle application icon (`Eagle.app/Contents/Resources/electron.icns`).
They identify the application this integration connects to.

The Eagle name, logo and related trademarks belong to their respective owners.
They are not covered by this repository's MIT license; no ownership or
redistribution license for those marks is asserted here. This project is an
unofficial integration and is not endorsed by Eagle or Magpie.

## Eagle AI model suite

The companion bridge requires the separately installed Eagle AI model suite
1.0.0. Its SDK and application files are not included in this repository or
release packages. SDK-dependent tests use a locally installed SDK when available
and are skipped when it is absent.
