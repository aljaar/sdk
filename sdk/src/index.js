import { v4 as uuid } from 'uuid';
import { emitter, wrapper, useProduct, useGeoJson, useGoogleMaps } from './helpers/wrapper';
import * as validator from './helpers/validate';

function Aljaar({ supabase }) {
  const states = {
    auth_state: null,
    session: null,
    user: null,
    tags: []
  };
  const redirect = {
    onResetPassword: 'http://localhost:3000/#/reset-password'
  }

  const { data: { publicUrl: avatar_public } } = supabase.storage
    .from('avatars')
    .getPublicUrl('public/avatar.default.webp');

  const usePublicUrl = (path) => supabase.storage.from('products').getPublicUrl(path);

  emitter.on('aljaar:on:error', (error) => {
    console.info(error.message);
  })

  supabase.auth.onAuthStateChange((event, session) => {
    states.auth_state = event;
    
    if (session) {
      states.session = session;
      states.user = session.user;
    } else {
      states.session = null;
      states.user = null;
    }

    switch (event) {
      case 'SIGNED_IN':
      case 'TOKEN_REFRESHED':
        emitter.emit('aljaar:auth:login', { event, session });

        if (event === 'TOKEN_REFRESHED') {
          emitter.emit('aljaar:auth:refreshed', { event, session });
        }
        break;
      case 'SIGNED_OUT':
        emitter.emit('aljaar:auth:logout', { event, session });
        break;
      default:
        emitter.emit('aljaar:on:auth', { event, session });
        break;
    }
  });

  return {
    emitter,
    raw: supabase,
    auth: {
      async user() {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from("profiles").select().eq("user_id", user.id).single();

        user.profile = profile;
        states.user = user;

        return user;
      },
      signInWith ({ type, credential = {} }) {
        switch (type) {
          case 'google':
          case 'facebook':
          case 'github':
            return wrapper(() => supabase.auth.signInWithOAuth({
              provider: type
            }));
          case 'email':
            return wrapper(() => supabase.auth.signInWithPassword({
              email: credential.email,
              password: credential.password,
            }));
        
          default:
            break;
        }
      },
      async signUp (data) {
        const { value: validated, error } = await wrapper(() => validator.signUp(data));
      
        if (error) {
          return { data: null, error }
        }

        return wrapper(() => supabase.auth.signUp({
          email: validated.email,
          password: validated.password,
          options: {
            data: {
              full_name: validated.full_name,
              avatar_url: avatar_public,
              phone: validated.phone
            }
          }
        }))
      },
      signOut () {
        return wrapper(() => supabase.auth.signOut());
      },
      resetPassword (email) {
        return wrapper(() => supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirect.onResetPassword,
        }));
      },
      updatePassword (password) {
        return wrapper(() => supabase.auth.updateUser({
          password
        }));
      },
      updateLocation () {
        return new Promise((resolve) => {
          if (!navigator.geolocation) {
            resolve({ data: null, error: { message: "Can't get user current location" } })
          }
  
          navigator.geolocation.getCurrentPosition((position) => {
            const { error } = wrapper(() => supabase.from('profiles').update({
              location: `SRID=4326;POINT(${position.coords.longitude} ${position.coords.latitude})`
            }).eq('user_id', states.user.id))

            resolve({ data: position.coords, error });
          }, () => {

          }, {
            maximumAge:60000,
            timeout:5000,
            enableHighAccuracy:true
          });
        })
      }
    },
    user: {
      me () {
        return states.user;
      },
      update (data) {

      },
      async getNeighborCount () {
        return wrapper(() => supabase.rpc("get_neighbor_count", {
          radius: 200,
        }));
      },
      async getNeighborProducts () {
        const { data: count, error } = await supabase.rpc("get_neighbor_products", {
          radius: 200,
        });

        console.log(count, error)
      },
    },
    product: {
      async detail (id) {
        const { data: product } = await wrapper(() => supabase
          .from('products')
          .select(`*, product_images ( image ), likes (count), product_tags ( tags (id, name) ), product_analytics ( view )`)
          .eq('id', id)
          .maybeSingle()
        );

        if (!product) return;

        const isOwner = (product.user_id === states.user.id);
        const transactionRPC = isOwner ? 'get_transactions' : 'count_transactions';

        const { data: transaction } = await wrapper(() => supabase.rpc(transactionRPC, {
          p_id: id
        }));

        product.transaction = transaction;

        await supabase.rpc('increment_view', {
          p_id: id
        });

        return useProduct(product).format(usePublicUrl);
      },
      async all () {
        const { data } = await wrapper(() => supabase
          .from('products')
          .select('*, product_images ( image ), likes (count), product_tags ( tags (id, name) ), product_analytics ( view )')
          .eq('user_id', states.user?.id)
        );

        const products = data.map(product => useProduct(product).format(usePublicUrl));

        return products;
      },
      async create ({ data, images }) {
        // Image Upload
        const uploadTasks = images.map(async (image) => {
          const ext = image.name.split('.').pop();
          const filename = `${uuid()}.${ext}`;

          const { data } = await wrapper(() => supabase.storage
            .from('products')
            .upload(`${states.user.id}/${filename}`, image));

          return data
        });

        const results = await Promise.all(uploadTasks);
        //const results = [ { path: '87789b6c-b404-4c96-8abc-3ec09e7f5ff9/7dde18ab-36c8-4a41-a49e-6d04a637dd7e.png' } ];
        const uploadedImages = results.map(image => image.path);

        const [ lat, lon ] = data.drop_point;

        const unvalidatedProduct = {
          ...data,
          images: uploadedImages
        }

        const { value: product, error } = await wrapper(() => validator.product(unvalidatedProduct));

        if (error) {
          return { data: null, error }
        }

        product.drop_point = `SRID=4326;POINT(${lon} ${lat})`;

        return wrapper(() => supabase.rpc('create_product', {
          product_raw: JSON.stringify(product),
          images: uploadedImages,
          drop_time: data.drop_time
        }));
      },
      async update (id, { data }) {
        // TODO: validate data
        const { value: product, error } = await wrapper(() => validator.editProduct({
          ...data,
        }));

        if (error) return { data: null, error };

        const { tags } = product;
        delete product.tags;

        if (product.drop_point) {
          const [ lat, lon ] = product.drop_point;
          
          product.drop_point = `SRID=4326;POINT(${lon} ${lat})`;
          console.log(product.drop_point)
        }

        const tasks = [
          wrapper(() => supabase.from('products').update({
            ...product
          }).eq('id', id))
        ];

        if (tags && tags.length > 0) {
          tasks.push(wrapper(() => supabase.rpc('add_product_tag', {
            p_id: id,
            tags
          })));
        }

        const update = await Promise.all(tasks);

        return {id, product, update};
      },
      async delete (id) {
        return wrapper(() => supabase.rpc('delete_product', {
          p_id: id
        }));
      },
      async like (id) {
        return wrapper(() => supabase.rpc('like_product', {
          p_id: id
        }));
      },
    },
    lists: {
      near (radius, filter = {}) {
        /**
         * Filter:
         * search
         * category
         * sort: { column, type }
         */
        const filters = [];

        if (filter.search && filter.search !== '') {
          filters.push(['or', `title.wfts.${filter.search.toLowerCase()},description.wfts.${filter.search.toLowerCase()}`]);
        }

        if (filter.category && filter.category !== '') {
          filters.push(['eq', 'category', filter.category]);
        }

        if (filter.sort && filter.sort.column && filter.sort.type) {
          filters.push(['order', filter.sort.column, { ascending: (filter.sort.type === 'asc') }])
        }

        const query = filters.reduce((chain, [ filter, ...args ]) => chain[filter](...args), supabase.rpc('get_near_products', {
          radius
        }));

        return wrapper(() => query)
      },
      async nearMap (radius, filter = {}) {
        const { data: products, error } = await this.near(radius, filter);

        if (error) return { data: null, error };

        return {
          data: useGeoJson(products),
          error: null
        };
      }
    },
    tags: {
      all () {
        return wrapper(() => supabase.from('tags').select('id, name'))
          .then(result => {
            if (result.error) return result;
            
            states.tags = result.data;

            return result;
          });
      },
      async search (query) {
        return wrapper(() => supabase.from('tags').select('id, name').limit(8).ilike('name', `%${query}%`))
      },
      useCache () {
        return {
          all () {
            return states.tags;
          },
          search (query) {
            console.log(states.tags)

            return states.tags.filter(item => (item.name.toLowerCase().includes(query.toLowerCase())))
          }
        }
      }
    },
    transaction: {
      async waiting () {
        const { data: transactions } = await supabase.from('transactions')
          .select('id, user_id, owner_id, product_id, created_at, products ( title, product_images (image) )')
          .eq('owner_id', states.user.id)
          .eq('status', 'waiting');

        const user_id = transactions.map(tx => tx.user_id);
        const { data: users } = await supabase.from('profiles')
          .select('user_id, full_name, avatar_url, status')
          .in('user_id', user_id);

        return {
          data: transactions.map(tx => ({
            ...tx,
            user: users.find(user => user.user_id == tx.user_id),
          }))
        }
      },
      // List of approved transactions and ready to pickup and need some review
      needReviews () {
        return wrapper(() => supabase.from('transactions')
          .select('*, products ( title, product_images (image) )')
          .eq('user_id', states.user.id)
          .eq('status', 'approved')
          .is('rating', null));
      },
      request(id) {
        return wrapper(() => supabase.rpc('request_transactions', {
          p_id: id
        }));
      },
      approve(id) {
        return wrapper(() => supabase.rpc('response_transactions', {
          tx_id: id,
          response: 'approved',
          reason: ''
        }));
      },
      reject(id, reason) {
        return wrapper(() => supabase.rpc('response_transactions', {
          tx_id: id,
          response: 'rejected',
          reason
        }));
      },
      review (id, { rating, comment }) {
        return wrapper(() => supabase.rpc('review_transactions', {
          tx_id: id,
          rating_value: rating,
          comment_value: comment
        }));
      }
    },
    helpers: {
      googleMaps ({ start, end }) {
        const link = useGoogleMaps({ start, end });

        return {
          link,
          openLink () {
            window.open(link, '_blank');
          }
        }
      }
    }
  }
}

export default Aljaar;
