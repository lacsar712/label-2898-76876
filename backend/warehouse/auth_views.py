import json
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse


def user_login(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)
                return JsonResponse({'success': True})
            else:
                return JsonResponse({'success': False, 'message': '用户名或密码错误'})
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)})
    return render(request, 'login.html')


def user_logout(request):
    logout(request)
    return redirect('login')
