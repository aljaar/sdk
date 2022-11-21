import { createClient } from '@supabase/supabase-js';
import Mapbox from 'mapbox-gl';
import { faker } from '@faker-js/faker';
import useSDK from './sdk/src/index';

const key = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpZmptaGhidXNqbHlweGJwbml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2Njc4NzAwMjgsImV4cCI6MTk4MzQ0NjAyOH0.epXBWgRKGVXrVXZDAoeMPcQ4ocAKaNA0jvUzBUoNzqQ`;
const supabase = createClient('https://iifjmhhbusjlypxbpniy.supabase.co', key);

// const key = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24ifQ.625_WdcF3KHqz5amU0x2X5WWHP-OEs_4qj0ssLNHzTs`;
// const supabase = createClient('http://localhost:54321', key);

const service = useSDK({
  supabase
});

Mapbox.accessToken = 'pk.eyJ1IjoicnlhbmF1bnVyIiwiYSI6ImNrN3FhdWlzNzAxbDEzZm52bHZwZm8yNGwifQ.h60r6ue0FMfXHfpiF96tZg';

const map = new Mapbox.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v10',
  zoom: 16,
  center: [112.7419, -7.2484],
});

function useButton(selector) {
  return document.querySelector(selector);
}

document.addEventListener('DOMContentLoaded', async () => {
  service.lists.near(200, {
    sort: {
      column: 'distance',
      type: 'dsc'
    }
  }).then(console.log);

  const loadImageMarker = () => new Promise((resolve) => {
    map.loadImage('https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png', (error, image) => {
      resolve(image);
    });
  });

  map.on('load', () => {
    map.addControl(new Mapbox.NavigationControl());

    service.lists.nearMap(200).then(async function ({ data }) {
      const image = await loadImageMarker();
  
      map.addImage('custom-marker', image);
      map.addSource('points', {
        type: 'geojson',
        cluster: true,
        clusterRadius: 80,
        data
      });

      // Menampilkan circle pada cluster
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'points',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#11b4da',
          'circle-radius': 18,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff'
        }
      });

      // Menampilkan layer jumlah cluster
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'points',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12,
        }
      });

      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'points',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#11b4da',
          'circle-radius': 12,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff'
        }
      });

      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['clusters']
        });
        const clusterId = features[0].properties.cluster_id;
        
        map.getSource('points').getClusterExpansionZoom(
          clusterId, (err, zoom) => {
            if (err) return;
         
            map.easeTo({
              center: features[0].geometry.coordinates,
              zoom: zoom
            });
          }
        );
      });

      map.on('click', 'unclustered-point', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
         
        // Ensure that if the map is zoomed out such that
        // multiple copies of the feature are visible, the
        // popup appears over the copy being pointed to.
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }
         
        console.log(e.features[0].properties, coordinates);
      });
    });
  });

  const productLists = document.querySelectorAll('.product-id-lists');
  const { data: products } = await service.raw.from("products").select("id,user_id");
  
  productLists.forEach(listELement => 
    listELement.innerHTML = products.map(({ id, user_id }) => 
      `<option value="${id}">${id}${(service.user.me().id === user_id) ? "(Me)" : ""}</option>`).join(''));
  
  const productListsNear = document.querySelectorAll('.product-id-lists-available');
  const { data: nearProducts } = await service.lists.near(200);

  productListsNear.forEach(listELement => 
    listELement.innerHTML = nearProducts.map(({ product_id: id, qty }) => 
      `<option value="${id}">${id} - QTY: ${qty}</option>`).join(''));
  
  const transactionLists = document.querySelectorAll('.product-id-lists-transactions');
  const { data: transactions } = await service.transaction.waiting();

  transactionLists.forEach(listELement => 
    listELement.innerHTML = transactions.map(({ id }) => `<option value="${id}">TX: ${id}</option>`).join(''));
  
  service.transaction.needReviews().then(console.log)
});

useButton('#do-signin').addEventListener('click', () => {
  service.auth.signInWith({
    type: 'email',
    credential: {
      email: 'nyanhashmail@gmail.com',
      password: 'testpassword'
    }
  })
});

useButton('#do-signin-google').addEventListener('click', async () => {
  await service.auth.signInWith({
    type: 'google',
    credential: {}
  })
});

useButton('#do-signup').addEventListener('click', async () => {
  const { data, error } = await service.auth.signUp({
    full_name: 'Ryan Aunur Rassyid',
    email: 'nyanhashmail@gmail.com',
    password: 'testpassword',
    phone: '+6285755504990'
  })

  console.log({ data, error })
});

document.querySelector('#do-signout').addEventListener('click', async () => {
  await service.auth.signOut();
});

document.querySelector('#fetch-my-products').addEventListener('click', async () => {
  const products = await service.product.all();

  console.table(products);
});

document.querySelector('#form-create-product').addEventListener('submit', async (event) => {
  event.preventDefault();

  const { files } = event.target.querySelector('input[type="file"]');

  const { error } = await service.product.create({
    images: Array.from(files),
    data: {
      title: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      category: 'food',
      tags: [ 1, 2 ],
      drop_point: faker.address.nearbyGPSCoordinate([ -7.2484, 112.7419 ], 200),
      drop_time: [ '11:00-14:00', '16:00-16:30' ],
      expired_at: new Date().toISOString()
    }
  })

  if (!error) {
    console.info(`Product has ben created!`)
  }
})

document.querySelector('#edit-product').addEventListener('click', async () => {
  const result = await service.product.update(12, {
    data: {
      drop_point: faker.address.nearbyGPSCoordinate([ -7.2484, 112.7419 ], 0.2, true),
    },
    images: []
  })

  console.log(result)
});

document.querySelector('#detail-product').addEventListener('click', async () => {
  const id = document.querySelector('#product-id-detail').value * 1;
  const result = await service.product.detail(id);

  console.log(result)
});

document.querySelector('#delete-product').addEventListener('click', async () => {
  const id = document.querySelector('#product-id-delete').value * 1;
  const result = await service.product.delete(id);

  console.log(result)
});

document.querySelector('#like-product').addEventListener('click', async () => {
  const id = document.querySelector('#product-id-like').value * 1;
  const result = await service.product.like(id);

  console.log(result)
});

document.querySelector('#request-product').addEventListener('click', async () => {
  const id = document.querySelector('#product-id-request').value * 1;
  const result = await service.transaction.request(id);

  console.log(result)
});

useButton('#approve-product').addEventListener('click', async () => {
  const id = document.querySelector('#product-id-response').value * 1;
  const result = await service.transaction.approve(id);

  console.log(result)
});
useButton('#reject-product').addEventListener('click', async () => {
  const id = document.querySelector('#product-id-response').value * 1;
  const result = await service.transaction.reject(id, 'Stock Habis');

  console.log(result)
});

document.querySelector('#fetch-tags').addEventListener('click', async () => {
  const tags = await service.tags.all();

  console.table(tags);
});

document.querySelector('#search-tags').addEventListener('input', async (event) => {
  const tags = service.tags.useCache().search(event.target.value);

  console.table(tags);
});

service.emitter.on('aljaar:on:auth', async ({ event, session }) => {
  if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
    const user = await service.auth.user();

    console.log(service.user.me())

    const { data, error } = await service.auth.updateLocation();

    if (!error) {
      console.log(data)
    }

    const profile = document.querySelector('#profile');

    profile.innerHTML = `
      <img src="${user.profile.avatar_url}" referrerpolicy="no-referrer" width="32" height="32" />
      <span>Full Name : ${user.profile.full_name}</span>
      <span>Email : ${user.email}</span>
    `
  }
});