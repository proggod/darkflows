(()=>{var e={};e.id=355,e.ids=[355],e.modules={10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},79646:e=>{"use strict";e.exports=require("child_process")},67082:(e,t,r)=>{"use strict";r.r(t),r.d(t,{patchFetch:()=>S,routeModule:()=>p,serverHooks:()=>x,workAsyncStorage:()=>c,workUnitAsyncStorage:()=>g});var s={};r.r(s),r.d(s,{GET:()=>l,POST:()=>u});var o=r(42706),a=r(28203),n=r(45994),i=r(39187),d=r(79646);async function l(){return console.log("=== SPEEDTEST START ==="),new i.NextResponse(new ReadableStream({async start(e){try{let t=(0,d.spawn)("speedtest",["--accept-license","--format=json"]),r="";e.enqueue('data: {"status": "Starting speed test..."}\n\n'),t.stdout.on("data",e=>{r+=e.toString()}),t.stderr.on("data",t=>{let r=t.toString();try{let t=JSON.parse(r);"log"!==t.type||"error"!==t.level||(console.log("Speedtest error:",t.message),t.message.includes("Timeout occurred")||(e.enqueue(`data: {"error": "${t.message}"}

`),e.close()))}catch{console.log("Speedtest stderr:",r)}}),t.on("error",t=>{console.log("Speedtest error:",t.message),e.enqueue(`data: {"error": "${t.message}"}

`),e.close()}),t.on("close",t=>{if(console.log("Speedtest exit code:",t),0===t&&r)try{let t=JSON.parse(r),s={download:8*t.download.bandwidth/1e6,upload:8*t.upload.bandwidth/1e6,idleLatency:t.ping.latency,jitterDown:t.download.latency.jitter,jitterUp:t.upload.latency.jitter,jitterIdle:t.ping.jitter,packetLoss:t.packetLoss,serverName:`${t.server.name} - ${t.server.location}`,isp:t.isp,resultUrl:t.result.url};e.enqueue(`data: {"result": ${JSON.stringify(s)}}

`)}catch(t){console.log("Parse error:",t),e.enqueue(`data: {"error": "Parse failed"}

`)}else e.enqueue(`data: {"error": "Test failed"}

`);console.log("=== SPEEDTEST END ==="),e.close()})}catch(t){console.log("Startup error:",t),e.enqueue(`data: {"error": "Startup failed"}

`),e.close()}}}),{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive"}})}async function u(){return i.NextResponse.json({success:!0})}let p=new o.AppRouteRouteModule({definition:{kind:a.RouteKind.APP_ROUTE,page:"/api/speedtest/route",pathname:"/api/speedtest",filename:"route",bundlePath:"app/api/speedtest/route"},resolvedPagePath:"/usr/local/darkflows/src/live-ifstat/app/api/speedtest/route.ts",nextConfigOutput:"",userland:s}),{workAsyncStorage:c,workUnitAsyncStorage:g,serverHooks:x}=p;function S(){return(0,n.patchFetch)({workAsyncStorage:c,workUnitAsyncStorage:g})}},96487:()=>{},78335:()=>{}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),s=t.X(0,[994,452],()=>r(67082));module.exports=s})();