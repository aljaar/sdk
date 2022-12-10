#### Get Neigbor Count around us

```sql
create or replace function get_neighbor_count(radius int) 
returns int
language plpgsql
as $$
declare
  user_location geography;
begin
  select location as user_location from profiles where auth.uid() = user_id into user_location;

  return (select COUNT(*)::int from profiles where ST_DWithin(location, (user_location)::geometry, radius) and auth.uid() <> user_id);
end
$$;
```

#### Get Neighbor Products

```sql
create or replace function get_neighbor_products(radius int) 
returns setof products
language plpgsql
as $$
  declare
    user_location geography;
  begin
    select location as user_location from profiles where auth.uid() = user_id into user_location;

    return query 
      select * from products where ST_DWithin(drop_point, (user_location)::geometry, radius) and auth.uid() <> user_id;
  end
$$;
```

#### Create a Product / Item

```sql
create or replace function create_product(product_raw text, images text[], drop_time text[]) 
returns setof products
as $$
  declare
    product json;
    product_id int8;
    tag int8;
    image_path text;
  begin
    product := (product_raw)::json;

    insert into products (user_id, title, description, drop_point, drop_time, category, used_since, expired_at)
    values (auth.uid(), product->>'title', product->>'description', (product->>'drop_point')::geography, drop_time, product->>'category', product->>'used_since', (product->>'expired_at')::date)
    returning id into product_id;

    foreach image_path in array images loop
      insert into product_images (product_id, image) 
      values (product_id, image_path);
    end loop;

    for tag in select json_array_elements from json_array_elements(product->'tags') loop
      insert into product_tags (product_id, tag_id)
      values (product_id, tag);
    end loop;

    return query 
      select * from products where id = product_id;
  end
$$ language plpgsql;
```

#### Add Product Tags

```sql
create or replace function add_product_tag(p_id int8, tags int8[]) returns void as $$
  declare
    t_id int8;
  begin
    foreach t_id in array tags loop
      if not exists (select id from product_tags where product_id = p_id and tag_id = t_id) then
        insert into product_tags (product_id, tag_id) values (p_id, t_id);
      end if;
    end loop;
  end
$$ language plpgsql;
```

#### Delete Product Tag

```sql
create or replace function delete_product_tag(p_id int8, tags int8[]) returns void as $$
  declare
    t_id int8;
  begin
    foreach t_id in array tags loop
      if not exists (select id from product_tags where product_id = p_id and tag_id = t_id) then
        delete from product_tags where product_id = p_id and tag_id = t_id;
      end if;
    end loop;
  end
$$ language plpgsql;
```

#### Delete Product

```sql
-- Delete Product
create or replace function delete_product(p_id int8) returns boolean as $$
  declare
    image_item record;
    tx_item record;
  begin
    if not exists (select id from products where id = p_id) then
      return false;
    end if;
    -- delete tags
    delete from product_tags where product_id = p_id;
    -- delete analytics
    delete from product_analytics where product_id = p_id;
    -- delete images
    for image_item in (select image from product_images where product_id = p_id) loop
      -- delete image on storage object
      delete from storage.objects where bucket_id = 'products' and name = image_item.image;
      -- delete image record
      delete from product_images where product_id = p_id;
    end loop;
    -- delete transaction
    for tx_item in (select id from transactions where product_id = p_id) loop
      -- delete tx logs
      delete from transaction_logs where transaction_id = tx_item.id;
      -- delete tx
      delete from transactions where id = tx_item.id;
    end loop;
    -- delete product
    delete from products where id = p_id;

    return true;
  end
$$ language plpgsql;
```

#### Like Product

```sql
-- Like Product
create or replace function like_product(p_id int8) returns int as $$
  declare
    image_item record;
  begin
    -- check is product is exists then like, otherwise return 0
    if not exists (select id from products where id = p_id) then
      return 0;
    end if;
    
    -- check is user already like the product, if it not then insert like
    if not exists (select from likes where product_id = p_id and user_id = auth.uid()) then
      insert into likes (product_id, user_id) values (p_id, auth.uid());
    end if;

    return (select COUNT(*)::int from likes where product_id = p_id);
  end
$$ language plpgsql;
```

#### Get Near Products

```sql
create or replace function get_near_products(radius int) returns table (
  product_id int8,
  title varchar,
  description text,
  qty numeric,
  profile json,
  like bigint,
  tags varchar[],
  image varchar,
  lat float,
  lon float,
  distance float,
  category varchar,
  view numeric,
  expired_at date
) as $$
  declare
    user_location geography;
  begin
    select location into user_location from profiles where auth.uid() = user_id;

    return query 
      select
        products.id as product_id,
        products.title,
        products.description,
        products.qty,
        to_json((array_agg(json_build_object('full_name', profiles.full_name, 'avatar_url', profiles.avatar_url, 'rating', profiles.rating)))[1]) as profile,
        count(likes) as like,
        array_agg(distinct(tags.name)) as tags,
        (array_agg(distinct(product_images.image)))[1] as image,
        st_y(drop_point::geometry) as lat,
        st_x(drop_point::geometry) as lon,
        ST_Distance(user_location::geography, products.drop_point::geography) as distance,
        products.category,
        product_analytics.view,
        products.expired_at
      from
        products
        inner join profiles on profiles.user_id = products.user_id
        inner join product_images on products.id = product_images.product_id
        inner join product_tags on products.id = product_tags.product_id
        left join product_analytics on products.id = product_analytics.product_id
        inner join tags on tags.id = product_tags.tag_id
        left join likes on products.id = likes.product_id
      where
        (ST_DWithin(user_location::geography, products.drop_point::geography, radius) and 
        (auth.uid() <> products.user_id))
      group by
        (products.id, product_analytics.view);
  end
$$ language plpgsql;
```

### Transactions

#### Get Transactions for Product
```sql
create or replace function get_transactions(p_id int8) returns table (
  id int8,
  taker json,
  rating float4,
  comment text,
  status varchar
) as $$
  declare
  begin
    -- is the request from the owner?
    if not exists (select 1 from transactions where product_id = p_id and owner_id = auth.uid()) then
      return;
    end if;

    -- if the onwer then 
    return query 
      select
        transactions.id,
        to_json((array_agg(json_build_object('full_name', profiles.full_name, 'avatar_url', profiles.avatar_url, 'rating', profiles.rating)))[1]) as taker,
        transactions.rating,
        transactions.comment,
        transactions.status
      from transactions
        inner join profiles on profiles.user_id = transactions.user_id
      where transactions.product_id = p_id
      group by transactions.id;
  end
$$ language plpgsql;
```

#### Get Transactions count for product
```sql
create or replace function count_transactions(p_id int8) returns int
as $$
  begin
    return (select count(*)::int from transactions where product_id = p_id and status = 'approved');
  end
$$ language plpgsql;
```

#### Waiting Transactions

```sql

```

#### Request Transactions
```sql
create or replace function request_transactions(p_id int8) returns text
as $$
  declare
    product record;
    tx_id int8;
  begin
    -- set variable product
    select * into product from products where id = p_id;

    -- is the request from the owner?
    if exists (select id from transactions where product_id = p_id and owner_id = auth.uid()) then
      return 'Whopss, owner of the product cannot make request for him self.'::text;
    end if;

    -- the user already made transactions on this product before?
    if exists (select id from transactions where product_id = p_id and user_id = auth.uid() and status = 'waiting') then
      return 'Whopss, you already made request on this product before.'::text;
    end if;

    -- is there any stock available on products?
    if (product.qty <= 0) then
      return 'Whopss, there is no stock available to share.'::text;
    end if;

    -- if stock available the make a request (transactions)
    insert into transactions (user_id, owner_id, product_id) values (auth.uid(), product.user_id, p_id) returning id into tx_id;
    insert into transaction_logs (transaction_id, status) values (tx_id, 'waiting'::text);

    return concat(tx_id::text, ':Product request has been sent, waiting for the owner response.')::text;
  end
$$ language plpgsql;
```

Acc atau reject akan update qty karena dipanggil oleh owner.

#### Response of the product request.
```sql
create or replace function response_transactions(tx_id int8, response text, reason text) returns boolean
as $$
  declare
    transaction record;
  begin
    select id, product_id, status into transaction from transactions where id = tx_id limit 1;

    if not found then
      return false;
    end if;

    if transaction.status != 'waiting'::text then
      return false;
    end if;

    if (response = 'approved'::text) then
      -- approve
      update transactions set status='approved'::varchar where id = tx_id;
      update products set qty=(qty-1) where id = transaction.product_id;
      insert into transaction_logs (transaction_id, status) values (tx_id, 'approved'::text);

      return true;
    elsif (response = 'rejected'::text) then
      -- reject
      update transactions set status='rejected'::varchar, reason=response where id = tx_id;
      insert into transaction_logs (transaction_id, status) values (tx_id, 'rejected'::text);
    
      return true;
    else
      return false;
    end if;
  end
$$ language plpgsql;
```

#### Give a review of the product.
```sql
create or replace function review_transaction (tx_id int8, rating_value numeric, comment_value text) returns boolean
as $$
  declare
    transaction record;
  begin
    select id, user_id into transaction from transactions where id = tx_id limit 1;

    if not found then
      return false;
    end if;

    if (transaction.user_id != auth.uid()) then
      return false;
    end if;

    update transactions set status='success'::text, rating=rating_value::float4, comment=comment_value where id = tx_id;
    insert into transaction_logs (transaction_id, status) values (tx_id, 'success'::text);

    return true;
  end
$$ language plpgsql;
```

#### Update product analytics view
```sql
create or replace function increment_view (p_id int8) returns void
as $$
  begin
    if exists (select from product_analytics where product_id = p_id) then
      update product_analytics
      set view=(view+1)
      where product_id = p_id;
    else
      insert into product_analytics (product_id) values (p_id);
    end if;
  end
$$ language plpgsql;
```

##### Geography Encoder
```sql
create or replace function geoencoder (geo text) returns table (
  lat float,
  lon float
) as $$
  begin
    return query
      select 
        st_y(geo::geometry) as lat,
        st_x(geo::geometry) as lon;
  end
$$ language plpgsql;
```

#### Profile Listed Product Count
```sql
create or replace function product_stats () returns table (
  all_time bigint,
  monthly bigint
) as $$
  begin
    return query
      select 
        (select count(*) from products where user_id = auth.uid() and status = 'deleted') as all_time,
        (select count(*) from products where user_id = auth.uid() and status = 'deleted' and extract(month from created_at) = extract(month from now())) as monthly;
  end
$$ language plpgsql;
```

#### Location Encoder
```sql
create or replace function geography_to_lat_long_address(location_text text) returns json 
as $$
  declare
    geom geometry;
    lat float;
    long float;
    address text;
    response json;
  begin
    -- Convert geography type to latitude and longitude
    geom := location_text::geometry;
    lat := ST_Y(geom);
    long := ST_X(geom);

    -- Use pgsql-http extension to make a request to a geocoding service to get the physical address
    select content::json->'result'->>'address' into address from http_get('https://xxxxx/?latlon=' || lat || ',' || long);

    -- Construct and return the response as a json object
    response := json_build_object('latitude', lat, 'longitude', long, 'address', address);
    return response;
  end;
$$ language plpgsql;
```

curl -X POST 'http://localhost:54321/rest/v1/rpc/get_neighbor_count' \
-d '{ "point": "0101000020E61000003C4ED1915CFE1CC03FC6DCB584D05040", "radius": 200 }' \
-H "Content-Type: application/json" \
-H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24ifQ.625_WdcF3KHqz5amU0x2X5WWHP-OEs_4qj0ssLNHzTs" \
-H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24ifQ.625_WdcF3KHqz5amU0x2X5WWHP-OEs_4qj0ssLNHzTs"
