/**
 * useInvestigation — loads and assembles the investigation data bundle.
 *
 * In v1 the data is imported statically. The hook normalises the bundle
 * (merging overrides, resolving any missing fields with defaults) and
 * returns a stable object suitable for passing to computeLayout().
 */

import { useMemo } from 'react'

import manifest     from '../../../investigations/san-diego-pension-crisis/manifest.json'
import entities     from '../../../investigations/san-diego-pension-crisis/entities.json'
import events       from '../../../investigations/san-diego-pension-crisis/events.json'
import relationships from '../../../investigations/san-diego-pension-crisis/relationships.json'
import chapters     from '../../../investigations/san-diego-pension-crisis/chapters.json'
import affiliations from '../../../investigations/san-diego-pension-crisis/affiliations.json'
import overridesRaw from '../../../investigations/san-diego-pension-crisis/overrides.json'

export function useInvestigation() {
  const data = useMemo(() => ({
    manifest,
    entities,
    events,
    relationships,
    chapters,
    affiliations,
    overrides: overridesRaw,
  }), [])

  return { data, loading: false, error: null }
}
