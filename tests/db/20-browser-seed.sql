update properties set price_display='₹75 Lakhs', listing_type='sale', category='residential', sub_type='apartment_flat', parking=1, built_up_area='1150 sq.ft' where slug='pub-medavakkam-2bhk';
insert into properties (slug,title,publish_status,location,bedrooms,parking,price_value,price_display,listing_type,category,sub_type,built_up_area) values
 ('villa-neelankarai','3 BHK Villa','Published','Neelankarai',3,2,25000000,'₹2.5 Cr','sale','residential','villa','2400 sq.ft'),
 ('lease-office-guindy','Office Space for Lease','Published','Guindy',null,4,150000,'₹1.5 L/month','lease','commercial','office_space','3000 sq.ft');
insert into insights (slug,title,excerpt,body,publish_status) values
 ('empty-article','Empty Article','No body yet',null,'Published'),
 ('full-article','Full Article','Has a body','<p>Real guidance text.</p>','Published');
