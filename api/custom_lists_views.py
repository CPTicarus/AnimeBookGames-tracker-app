from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from .models import CustomList, CustomListEntry
from .serializers import CustomListSerializer, CustomListEntrySerializer
from .models import UserMedia
from api.authentication import ExpiringTokenAuthentication

class CustomListViewSet(viewsets.ModelViewSet):
    serializer_class = CustomListSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [ExpiringTokenAuthentication]

    def get_queryset(self): #type: ignore
        return CustomList.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class CustomListEntryViewSet(viewsets.ModelViewSet):
    serializer_class = CustomListEntrySerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [ExpiringTokenAuthentication]

    def get_queryset(self): #type: ignore
        return CustomListEntry.objects.filter(custom_list__user=self.request.user)

    def perform_create(self, serializer):
        custom_list_id = self.request.data.get('custom_list') #type: ignore
        user_media_id = self.request.data.get('user_media') #type: ignore
        custom_list = CustomList.objects.get(id=custom_list_id, user=self.request.user)
        user_media = UserMedia.objects.get(id=user_media_id, profile__user=self.request.user)
        serializer.save(custom_list=custom_list, user_media=user_media)
