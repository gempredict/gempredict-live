# HEIC decoder regression fixture

`example.heic` is the unmodified public libheif example image from:
https://github.com/strukturag/libheif/blob/v1.19.8/examples/example.heic

SHA-256: `7f8b363e4936c0666a25f64f3a92fda10bd8e5453be4592530b65a55dd98f3f2`

libheif sample applications are distributed under the MIT license, reproduced
unchanged in LICENSE. Upstream attribution: Copyright (c) 2017-2020 Struktur AG;
Copyright (c) 2017-2025 Dirk Farin.

This is a test-only image, never a catalog identity or production record. Browser
regressions decode it locally with the actual bundled HEIC decoder; requests are
intercepted and no providers are called. The private user's 2.1 MB photograph is
not available in this repository and still requires real-device acceptance.
