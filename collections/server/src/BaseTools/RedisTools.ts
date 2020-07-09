import { buildPath, processPath } from "../MacroRoutines/RequestHandling";
import RedisSMQ from "rsmq";
import { promisify } from "util";
import * as config from "../Config/config";


export const queueName = "projection-tasks";
export const rsmq = new RedisSMQ({ns : config.redisNamespace, realtime: true});

export const createQueuePromise = promisify(rsmq.createQueue);
const sendMessagePromise = promisify(rsmq.sendMessage);
const receiveMessagePromise = promisify(rsmq.receiveMessage);
const deleteMessagePromise = promisify(rsmq.deleteMessage);

export async function setup():Promise<void>
{
    await createQueuePromise({qname: queueName})
    .then( () => console.log('Queue created'))
    .catch( (err:Error) => 
    {
        if(err.name === "queueExists") console.log("Queue already created");
        else console.error(err);
    });
}

export async function pushPending(path:string):Promise<void>
{
    let processedPath = processPath(path);
    if(processedPath.collections.length === processedPath.documents.length)
    {
        await sendMessagePromise({qname: queueName, message: buildPath(processedPath.collections, processedPath.documents.slice(0,-1)) });
        return;
    } 
    if(processedPath.collections.length === processedPath.documents.length + 1)
    {
        await sendMessagePromise({qname: queueName, message: buildPath(processedPath.collections, processedPath.documents)});
        return;
    }
    throw new Error("Invalid path");
}

export async function peekPending():Promise<RedisSMQ.QueueMessage | null>
{
    return receiveMessagePromise({ qname: queueName, vt:60 })
    .then( (result:{} | RedisSMQ.QueueMessage) =>
    {
        if(Object.keys(result).length === 0) return null;
        return result as RedisSMQ.QueueMessage;
    })
    .catch( (err:Error) => 
    {
        console.log(err);
        return null;
    });
}

export async function removePending(id:string):Promise<void>
{
    await deleteMessagePromise( {qname : queueName, id: id});
    return;
}