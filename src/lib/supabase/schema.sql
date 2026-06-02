-- Members (LINE users)
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  line_user_id text unique not null,
  display_name text not null,
  picture_url text,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Restaurants
create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_zh text not null,
  description text,
  image_url text,
  location_ids text[] default '{}',
  available_days integer[] default '{1,2,3,4,5}',
  cutoff_hour integer default 21,
  min_order integer default 0,
  delivery_fee integer default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- Menu items
create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  name text not null,
  name_zh text not null,
  description text,
  price integer not null,
  image_url text,
  available boolean default true,
  category text default 'bento',
  sort_order integer default 0
);

-- Coupons
create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_type text check (discount_type in ('fixed', 'percent')) not null,
  discount_value integer not null,
  min_order integer default 0,
  max_uses integer default 100,
  used_count integer default 0,
  expires_at timestamptz,
  restaurant_id uuid references restaurants(id),
  active boolean default true,
  created_at timestamptz default now()
);

-- Orders
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  member_id uuid references members(id) on delete set null,
  restaurant_id uuid references restaurants(id) on delete set null,
  location_id text not null,
  delivery_date date not null,
  status text check (status in ('pending','confirmed','preparing','ready','delivered','cancelled')) default 'pending',
  subtotal integer not null,
  discount integer default 0,
  delivery_fee integer default 0,
  total integer not null,
  coupon_code text,
  coupon_id uuid references coupons(id),
  special_note text,
  sheets_synced boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Order items
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  menu_item_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price integer not null,
  note text
);

-- Indexes
create index if not exists idx_orders_member_id on orders(member_id);
create index if not exists idx_orders_delivery_date on orders(delivery_date);
create index if not exists idx_orders_restaurant_id on orders(restaurant_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_order_items_order_id on order_items(order_id);

-- RLS Policies
alter table members enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger orders_updated_at before update on orders
  for each row execute function update_updated_at();
create trigger members_updated_at before update on members
  for each row execute function update_updated_at();
