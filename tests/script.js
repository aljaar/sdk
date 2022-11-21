import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import Mapbox from 'https://cdn.skypack.dev/mapbox-gl';
import useSDK from '../dist/aljaar-sdk.module.js';

const key = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpZmptaGhidXNqbHlweGJwbml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2Njc4NzAwMjgsImV4cCI6MTk4MzQ0NjAyOH0.epXBWgRKGVXrVXZDAoeMPcQ4ocAKaNA0jvUzBUoNzqQ`;
const supabase = createClient('https://iifjmhhbusjlypxbpniy.supabase.co', key);

// const key = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24ifQ.625_WdcF3KHqz5amU0x2X5WWHP-OEs_4qj0ssLNHzTs`;
// const supabase = createClient('http://localhost:54321', key);

const service = useSDK({
  supabase
});

Mapbox.accessToken = 'pk.eyJ1IjoicnlhbmF1bnVyIiwiYSI6ImNrN3FhdWlzNzAxbDEzZm52bHZwZm8yNGwifQ.h60r6ue0FMfXHfpiF96tZg';

// const map = new Mapbox.Map({
//   container: 'map',
//   style: 'mapbox://styles/mapbox/streets-v11',
//   zoom: 9
// });

document.addEventListener('DOMContentLoaded', () => {
  service.user.getNeighborProducts().then(console.log);
});

document.querySelector('#do-signin').addEventListener('click', () => {
  service.auth.signInWith({
    type: 'email',
    credential: {
      email: 'ryanaunur@gmail.com',
      password: 'testpassword'
    }
  })
});

document.querySelector('#do-signin-google').addEventListener('click', async () => {
  await service.auth.signInWith({
    type: 'google',
    credential: {}
  })
});

document.querySelector('#do-signin-facebook').addEventListener('click', async () => {
  await service.auth.signInWith({
    type: 'facebook',
    credential: {}
  })
});

document.querySelector('#do-signup').addEventListener('click', () => {
  service.auth.signUp({
    name: 'Ryan Aunur Rassyid',
    email: 'ryanaunur@gmail.com',
    password: 'testpassword',
    phone: '+6285755504990'
  })
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

  await service.product.create({
    images: Array.from(files),
    data: {
      title: "Ini judul produk",
      description: "Ini deskripsi produknya",
      category: 'non-food',
      tags: [ 1, 2 ],
      drop_point: [ -7.2484, 112.7419 ],
      drop_time: [ '11:00-14:00', '16:00-16:30' ],
      used_since: '2 bulan yang lalu',
      expired_at: new Date().toISOString()
    }
  })
})

document.querySelector('#fetch-tags').addEventListener('click', async () => {
  const tags = await service.tags.all();

  console.table(tags);
});

document.querySelector('#search-tags').addEventListener('change', async (event) => {
  const tags = await service.tags.search(event.target.value);

  console.table(tags);
});

service.emitter.on('aljaar:on:auth', async ({ event, session }) => {
  if (event === "SIGNED_IN") {
    const user = await service.auth.user();

    document.querySelector('#access-token').value = session.access_token;
    document.querySelector('#refresh-token').value = session.refresh_token;

    const { data, error } = await service.auth.updateLocation();

    if (!error) {
      // map.flyTo({
      //   center: [ data.longitude, data.latitude ]
      // })

      console.log(data)
    }
  }
});