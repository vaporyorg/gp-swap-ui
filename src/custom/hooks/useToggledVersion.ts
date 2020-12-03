import { Version, DEFAULT_VERSION } from '@src/hooks/useToggledVersion'
export { Version, DEFAULT_VERSION }

export default function useToggledVersion(): Version {
  // Disable changing the version. We'll use the default. Selecting V1 doesn't make sense in GP
  return DEFAULT_VERSION
}
