import type { Amenity, Cafe, SortBy } from '../types'
import { http } from './http'

export type GetCafesParams = {
  lat: number
  lng: number
  radius_m: number
  amenities?: Amenity[]
  sort?: SortBy
  signal?: AbortSignal
}

export async function getCafes(params: GetCafesParams): Promise<Cafe[]> {
  const { lat, lng, radius_m, amenities, sort, signal } = params

  const res = await http.get<Cafe[]>('/api/cafes', {
    signal,
    params: {
      lat,
      lng,
      radius_m,
      sort: sort ?? 'distance',
      amenities: amenities?.length ? amenities.join(',') : undefined,
    },
  })

  return res.data
}
