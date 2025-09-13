// Deprecated Sonner shim — replaced by react-hot-toast globally.
// Keeping this file as a safe no-op export to avoid import errors.

import React from 'react'

export type ToasterProps = Record<string, never>

export const Toaster: React.FC<ToasterProps> = () => null
