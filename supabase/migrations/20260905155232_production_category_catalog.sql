-- Category catalog is application configuration, not sample trivia.
-- Keep editorial changes on existing installations.
insert into public.categories(id,name,icon,color,description,sort_order) values
 ('geography','Geography','globe','#3F7D7C','A little wonder around the world.',0),
 ('science','Science','flask','#6C73B8','Discover the extraordinary in the everyday.',1),
 ('history','History','hourglass','#BB8848','Big moments. Curious stories.',2),
 ('food','Food & Drink','restaurant','#CE543C','A fresh serving of curiosity.',3),
 ('nature','Nature','leaf','#68966B','Explore our remarkable living world.',4),
 ('entertainment','Entertainment','film','#B47596','Stories, songs, and the things we love.',5)
on conflict(id) do nothing;
