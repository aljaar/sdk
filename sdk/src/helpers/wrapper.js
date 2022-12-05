import mitt from 'mitt';
import center from '@turf/center';
import { points } from '@turf/helpers';

export const emitter = mitt(); 

export const wrapper = async (handler) => {
  const result = await handler();

  if (!!result.error) {
    emitter.emit('aljaar:on:error', result.error);
  }

  return result;
}

export const useProduct = (product) => {
  const tags = product.product_tags;
  const images = product.product_images;
  const [analytics] = product.product_analytics;

  delete product.product_tags;
  delete product.product_images;
  delete product.product_analytics;

  return {
    format (usePublicUrl) {
      return {
        ...product,
        likes: product.likes[0].count,
        view: analytics?.view || 0,
        images: images
          .map(({ image }) => usePublicUrl(image))
          .map(image => image.data.publicUrl),
        tags: tags.map(({ tags: { id, name } }) => ({ id, name }))
      }
    }
  }
}

export const useGeoJson = (products) => {
  const features = products.map(product => {
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          product.lon, product.lat
        ]
      },
      properties: {
        ...product
      }
    }
  });

  return {
    type: 'FeatureCollection',
    features
  }
}

export const useGoogleMaps = ({ start, stop }) => {
  const locations = points([
    start,
    stop,
  ]);

  const centerOfLocations = center(locations).geometry.coordinates;

  return `https://www.google.com/maps/dir/${start.join(',')}/${stop.join(',')}/@${centerOfLocations.join(',')},11z/data=!4m5!4m4!1m1!4e1!1m0!3e0`
}

/**
 * 
 * @param {*} supabase 
 * @param {string} geography 
 * @returns {Promise<{lat: string,lon: string}>}
 */
export const geographyToCoordinates = async (supabase, geography) => {
  const { data: coordinates } = await supabase.rpc('geoencoder', {
    geo: geography
  });

  return coordinates;
}
