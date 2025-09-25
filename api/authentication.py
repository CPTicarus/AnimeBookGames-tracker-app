from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework import exceptions


class ExpiringTokenAuthentication(TokenAuthentication):
    """
    TokenAuthentication that enforces token expiry based on user preference.

    Behavior:
    - If the user's profile has `keep_user_logged_in` set to True (or missing),
      the token will not be considered expired (unless settings enforce it).
    - If `keep_user_logged_in` is False, a short TTL will be applied and the
      token will be treated as expired once older than that TTL.

    Config (in Django settings, optional):
    - TOKEN_EXPIRE_DAYS_NO_KEEP: int (default: 1)
        Number of days before tokens for users who do NOT want to stay logged in expire.
    - TOKEN_EXPIRE_DAYS_KEEP_LOGGED_IN: int or None (default: None)
        If set, tokens for users who WANT to stay logged in will expire after this many days.
        If None, such tokens do not expire here.
    """

    def authenticate_credentials(self, key):
        model = self.get_model()
        try:
            token = model.objects.select_related('user').get(key=key)
        except model.DoesNotExist:
            raise exceptions.AuthenticationFailed('Invalid token.')

        if not token.user.is_active:
            raise exceptions.AuthenticationFailed('User inactive or deleted.')

        # Determine TTL depending on the user's profile preference
        ttl_days = None
        try:
            profile = token.user.profile
            keep = getattr(profile, 'keep_user_logged_in', True)
            if keep:
                ttl_days = getattr(settings, 'TOKEN_EXPIRE_DAYS_KEEP_LOGGED_IN', None)
            else:
                ttl_days = getattr(settings, 'TOKEN_EXPIRE_DAYS_NO_KEEP', 1)
        except Exception:
            # If profile lookup fails, fall back to the conservative expiry
            ttl_days = getattr(settings, 'TOKEN_EXPIRE_DAYS_NO_KEEP', 1)

        if ttl_days is not None:
            now = timezone.now()
            # token.created is a datetime
            age = now - token.created
            if age.days >= int(ttl_days):
                # Token expired: delete and fail authentication
                try:
                    token.delete()
                except Exception:
                    pass
                raise exceptions.AuthenticationFailed('Token has expired.')

        return (token.user, token)
