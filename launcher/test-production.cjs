const {createRequire}=require('module');
const fs=require('fs');
const root=require('path').resolve(__dirname,'..');
process.chdir(root);
const req=createRequire(root+'/package.json');
const {chromium}=req('playwright');
const originalLaunch=chromium.launch.bind(chromium);
chromium.launch=async options=>{
  console.log('Launch requested:',JSON.stringify({headless:options.headless,executablePath:chromium.executablePath()}));
  const browser=await originalLaunch(options);
  const originalContext=browser.newContext.bind(browser);
  browser.newContext=async options=>{
    const context=await originalContext(options);
    await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Job Tracker Browser Check</title><h1>Chromium opened successfully</h1><p>Local diagnostic. No application is being sent.</p>'}));
    return context;
  };
  return browser;
};
(async()=>{
  const start=await req(root+'/.next-desktop/server/app/api/automation/start/route.js');
  
  const job=JSON.parse(fs.readFileSync(root+'/src/data/jobs.json','utf8'))[0];
  const res=await start.routeModule.userland.POST(new Request('http://localhost:3000/api/automation/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobId:job.id,forceNew:true})}));
  const result=await res.json();
  console.log('Start HTTP status:',res.status,'Session created:',Boolean(result.sessionId));
  if(!result.sessionId){console.log(result.error);process.exitCode=1;return;}
  const session=globalThis.__automationSessions.get(result.sessionId);
  for(let i=0;i<40;i++){
    if(['FAILED','PAGE_PAUSED','NEEDS_ATTENTION','WAITING_FOR_HUMAN'].includes(session.stateManager.getState()))break;
    await new Promise(r=>setTimeout(r,500));
  }
  const status=session.stateManager.getStatus();
  console.log('Result:',status.state,'Error:',status.error||'none','Browser alive:',session.browserManager.isAlive());
  const stream=await req(root+'/.next-desktop/server/app/api/automation/session/[id]/stream/route.js');
  const controller=new AbortController();
  const events=await stream.routeModule.userland.GET(new Request('http://localhost/api/automation/session/'+result.sessionId+'/stream',{signal:controller.signal}),{params:{id:result.sessionId}});
  console.log('SSE HTTP status:',events.status);
  const reader=events.body.getReader();
  await reader.read();controller.abort();await reader.cancel(); await new Promise(r=>setTimeout(r,100)); console.log("Listeners after disconnect:",session.stateManager.listenerCount("log")); session.stateManager.log("info","Disconnect regression check"); await new Promise(r=>setTimeout(r,100));
  const second = await stream.routeModule.userland.GET(new Request('http://localhost/api/automation/session/'+result.sessionId+'/stream'),{params:{id:result.sessionId}});
  const secondReader = second.body.getReader();
  await secondReader.read();
  await secondReader.cancel();
  console.log('Listeners after reader cancellation:',session.stateManager.listenerCount('log'));
  session.stateManager.log('info','Cancellation regression check');
  await new Promise(r=>setTimeout(r,100));
  await session.abort();
  if(status.error || status.state !== 'NEEDS_ATTENTION' || events.status !== 200 || session.stateManager.listenerCount('log') !== 0) process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});



