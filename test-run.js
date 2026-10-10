const { ServicesClient } = require('@google-cloud/run').v2;
async function test() {
  try {
    const runClient = new ServicesClient();
    const name = `projects/cloud-dns-failover-demo-511215/locations/asia-south1/services/failover-primary`;
    console.log("Calling getService...");
    const [service] = await runClient.getService({ name });
    console.log("Success", !!service);
  } catch (err) {
    console.log("Caught:", err.message);
  }
}
test();
