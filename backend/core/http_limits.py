"""Bound request bodies before framework multipart/JSON parsing."""
import asyncio
import tempfile
from fastapi import HTTPException, Request
from starlette.responses import JSONResponse
from core.deps import get_current_user


class RequestLimitsMiddleware:
    def __init__(self, app):
        self.app = app
        self.upload_slots = asyncio.Semaphore(4)

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or scope['method'] not in ('POST','PUT','PATCH'):
            return await self.app(scope,receive,send)
        upload = scope['path']=='/files/upload' or scope['path'].endswith('/import-docx')
        if upload:
            try:
                user = await get_current_user(Request(scope))
                if scope['path'].endswith('/import-docx') and user['role'] not in ('admin','teacher'):
                    raise HTTPException(403,'Insufficient permissions')
            except HTTPException as exc:
                return await JSONResponse({'detail':exc.detail},status_code=exc.status_code)(scope,receive,send)
        limit = 26*1024*1024 if upload else 2*1024*1024
        headers = dict(scope['headers'])
        try:
            length = int(headers.get(b'content-length',b'0'))
        except ValueError:
            return await JSONResponse({'detail':'Invalid content length'},status_code=400)(scope,receive,send)
        if length > limit:
            return await JSONResponse({'detail':'Request body too large'},status_code=413)(scope,receive,send)
        if upload:
            async with self.upload_slots:
                return await self.read_and_dispatch(scope,receive,send,limit)
        return await self.read_and_dispatch(scope,receive,send,limit)

    async def read_and_dispatch(self,scope,receive,send,limit):
        with tempfile.SpooledTemporaryFile(max_size=256*1024) as body:
            size = 0
            while True:
                message = await receive()
                if message['type']=='http.disconnect':
                    return
                chunk = message.get('body',b'')
                size += len(chunk)
                if size > limit:
                    return await JSONResponse({'detail':'Request body too large'},status_code=413)(scope,receive,send)
                await asyncio.to_thread(body.write,chunk)
                if not message.get('more_body',False):
                    break
            body.seek(0)
            delivered = 0
            async def replay():
                nonlocal delivered
                if delivered >= size:
                    # Streaming responses may listen for the actual disconnect.
                    return await receive()
                chunk = await asyncio.to_thread(body.read,64*1024)
                delivered += len(chunk)
                return {'type':'http.request','body':chunk,'more_body':delivered<size}
            if size == 0:
                async def empty(): return {'type':'http.request','body':b'','more_body':False}
                return await self.app(scope,empty,send)
            return await self.app(scope,replay,send)
