!function(e,r){"object"==typeof exports&&"undefined"!=typeof module?module.exports=r(require("uuid"),require("mitt"),require("joi")):"function"==typeof define&&define.amd?define(["uuid","mitt","joi"],r):(e||self).aljaarSdk=r(e.uuid,e.mitt,e.joi)}(this,function(e,r,t){function n(e){return e&&"object"==typeof e&&"default"in e?e:{default:e}}var a=/*#__PURE__*/n(r),i=/*#__PURE__*/n(t);function o(){return o=Object.assign?Object.assign.bind():function(e){for(var r=1;r<arguments.length;r++){var t=arguments[r];for(var n in t)Object.prototype.hasOwnProperty.call(t,n)&&(e[n]=t[n])}return e},o.apply(this,arguments)}var u=a.default(),s=function(e){try{return Promise.resolve(e()).then(function(e){return e.error&&u.emit("aljaar:on:error",e.error),e})}catch(e){return Promise.reject(e)}},l=/^(^\+62|62|^08)(\d{3,4}-?){2}\d{3,4}$/;return function(r){var t=r.supabase,n={auth_state:null,session:null,user:null},a=t.storage.from("avatars").getPublicUrl("public/avatar.default.webp").data.publicUrl;return u.on("aljaar:on:error",function(e){console.info(e.message)}),t.auth.onAuthStateChange(function(e,r){console.log({event:e,session:r}),n.auth_state=e,r?(n.session=r,n.user=r.user):(n.session=null,n.user=null),u.emit("aljaar:on:auth",{event:e,session:r})}),{emitter:u,auth:{user:function(){try{return Promise.resolve(t.auth.getUser()).then(function(e){var r=e.data.user;return Promise.resolve(t.from("profiles").select().eq("user_id",r.id).single()).then(function(e){return r.profile=e.data,n.user=r,r})})}catch(e){return Promise.reject(e)}},signInWith:function(e){var r=e.type,n=e.credential,a=void 0===n?{}:n;switch(r){case"google":case"facebook":case"github":return s(function(){return t.auth.signInWithOAuth({provider:r})});case"email":return s(function(){return t.auth.signInWithPassword({email:a.email,password:a.password})})}},signUp:function(e){try{return Promise.resolve(s(function(){return function(e){return i.default.object({full_name:i.default.string().required(),email:i.default.string().email({minDomainSegments:2,tlds:{allow:["com","net"]}}).required(),password:i.default.string().min(8).alphanum().required(),phone:i.default.string().regex(l).required()}).validate(e)}(e)})).then(function(e){var r=e.value,n=e.error;return n?{data:null,error:n}:s(function(){return t.auth.signUp({email:r.email,password:r.password,options:{data:{full_name:r.full_name,avatar_url:a,phone:r.phone}}})})})}catch(e){return Promise.reject(e)}},signOut:function(){return s(function(){return t.auth.signOut()})},resetPassword:function(e){return s(function(){return t.auth.resetPasswordForEmail(e,{redirectTo:"http://localhost:3000/"})})},updateLocation:function(){return new Promise(function(e){navigator.geolocation||e({data:null,error:{message:"Can't get user current location"}}),navigator.geolocation.getCurrentPosition(function(r){var a=s(function(){return t.from("profiles").update({location:"SRID=4326;POINT("+r.coords.latitude+" "+r.coords.longitude+")"}).eq("user_id",n.user.id)});e({data:r.coords,error:a.error})},function(){},{maximumAge:6e4,timeout:5e3,enableHighAccuracy:!0})})}},user:{me:function(){},update:function(e){},getNeighborCount:function(){try{return Promise.resolve(t.rpc("get_neighbor_count",{radius:200})).then(function(e){console.log(e.data,e.error)})}catch(e){return Promise.reject(e)}},getNeighborProducts:function(){try{return Promise.resolve(t.rpc("get_neighbor_products",{radius:200})).then(function(e){console.log(e.data,e.error)})}catch(e){return Promise.reject(e)}}},product:{detail:function(e){try{return Promise.resolve(s(function(){return t.from("products").select("*, product_tags!inner ( tags (id, name) )")}).eq("id",e)).then(function(e){return e.data.map(function(e){var r=e.product_tags;return delete e.product_tags,o({},e,{images:e.images.map(function(e){return t.storage.from("products").getPublicUrl(e)}).map(function(e){return e.data.publicUrl}),tags:r.map(function(e){var r=e.tags;return{id:r.id,name:r.name}})})})})}catch(e){return Promise.reject(e)}},all:function(){try{return Promise.resolve(s(function(){var e;return t.from("products").select("*, product_images ( image ), product_tags!inner ( tags (id, name) )").eq("user_id",null==(e=n.user)?void 0:e.id)})).then(function(e){return e.data.map(function(e){var r=e.product_tags,n=e.product_images;return delete e.product_tags,delete e.product_images,o({},e,{images:n.map(function(e){var r=e.image;return t.storage.from("products").getPublicUrl(r)}).map(function(e){return e.data.publicUrl}),tags:r.map(function(e){var r=e.tags;return{id:r.id,name:r.name}})})})})}catch(e){return Promise.reject(e)}},create:function(r){var a=r.data,u=r.images;try{var l=u.map(function(r){try{var a=r.name.split(".").pop(),i=e.v4()+"."+a;return Promise.resolve(s(function(){return t.storage.from("products").upload(n.user.id+"/"+i,r)})).then(function(e){return e.data})}catch(e){return Promise.reject(e)}});return Promise.resolve(Promise.all(l)).then(function(e){var r=e.map(function(e){return e.path}),n=a.drop_point,u=n[0],l=n[1],d=o({},a,{images:r});return Promise.resolve(s(function(){return function(e){return i.default.object().keys({title:i.default.string().min(8).label("Title").required(),description:i.default.string().label("Description").required(),category:i.default.string().valid("food","non-food").label("Category").required(),tags:i.default.array().items(i.default.number()).min(1).label("Tags").required(),drop_point:i.default.array().items(i.default.number()).label("Pick Up Point").required(),drop_time:i.default.array().items(i.default.string()).label("Pick Up Time").required(),images:i.default.array().items(i.default.string()).min(1).label("Images").required(),used_since:i.default.when("category",{is:i.default.string().valid("non-food").required(),then:i.default.string().label("Used Since").required()}),expired_at:i.default.when("category",{is:i.default.string().valid("food").required(),then:i.default.date().iso().label("Expired Date").required()})}).validate(e)}(d)})).then(function(e){var n=e.value,i=e.error;return i?{data:null,error:i}:(n.drop_point="SRID=4326;POINT("+u+" "+l+")",s(function(){return t.rpc("create_product",{product_raw:JSON.stringify(n),images:r,drop_time:a.drop_time})}))})})}catch(e){return Promise.reject(e)}},update:function(e,r){var n=r.data;try{return Promise.resolve(s(function(){return function(e){return i.default.object().keys({title:i.default.string().min(8).label("Title").optional(),description:i.default.string().label("Description").optional(),category:i.default.string().valid("food","non-food").label("Category").optional(),tags:i.default.array().items(i.default.number()).label("Tags").optional(),drop_point:i.default.array().items(i.default.number()).label("Pick Up Point").optional(),drop_time:i.default.array().items(i.default.string()).label("Pick Up Time").optional(),images:i.default.array().items(i.default.string()).label("Images").optional(),used_since:i.default.when("category",{is:i.default.string().valid("non-food").required(),then:i.default.string().label("Used Since").optional()}),expired_at:i.default.when("category",{is:i.default.string().valid("food").required(),then:i.default.date().iso().label("Expired Date").optional()})}).validate(e)}(o({},n))})).then(function(r){var n=r.value,a=r.error;if(a)return{data:null,error:a};var i=n.tags;return delete n.tags,Promise.resolve(Promise.all([s(function(){return t.rpc("add_product_tag",{p_id:e,tags:i})}),s(function(){return t.from("products").update(o({},n)).eq("id",e)})])).then(function(r){return{id:e,product:n,update:r}})})}catch(e){return Promise.reject(e)}},delete:function(e){try{return Promise.resolve(s(function(){return t.rpc("delete_product",{p_id:e})}))}catch(e){return Promise.reject(e)}}},lists:{},tags:{all:function(){return s(function(){return t.from("tags").select("id, name").limit(8)})},search:function(e){try{return Promise.resolve(s(function(){return t.from("tags").select("id, name").limit(8).ilike("name","%"+e+"%")}))}catch(e){return Promise.reject(e)}}}}}});
//# sourceMappingURL=aljaar-sdk.umd.js.map