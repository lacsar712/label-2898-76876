from django.contrib import admin
from .models import (
    MeasureUnit, GoodsCategory, GoodsVariety, GoodsInbound, GoodsOutbound,
    WarehouseZone, Message,
)


@admin.register(MeasureUnit)
class MeasureUnitAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')
    search_fields = ('name',)


@admin.register(GoodsCategory)
class GoodsCategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')
    search_fields = ('name',)


@admin.register(GoodsVariety)
class GoodsVarietyAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'category', 'unit', 'stock_quantity')
    list_filter = ('category',)
    search_fields = ('name',)


@admin.register(GoodsInbound)
class GoodsInboundAdmin(admin.ModelAdmin):
    list_display = ('inbound_no', 'variety', 'quantity', 'inbound_date', 'operator', 'status')
    list_filter = ('status', 'inbound_date')
    search_fields = ('inbound_no', 'variety__name')


@admin.register(GoodsOutbound)
class GoodsOutboundAdmin(admin.ModelAdmin):
    list_display = ('outbound_no', 'variety', 'quantity', 'receiving_unit', 'receiver', 'outbound_date', 'operator', 'status')
    list_filter = ('status', 'outbound_date', 'receiving_unit')
    search_fields = ('outbound_no', 'variety__name', 'receiver')


@admin.register(WarehouseZone)
class WarehouseZoneAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'warehouse', 'area', 'capacity_limit', 'manager', 'status')
    list_filter = ('warehouse', 'status')
    search_fields = ('code', 'name', 'manager')


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'message_type', 'sender', 'receiver', 'is_read', 'created_at', 'biz_no')
    list_filter = ('message_type', 'is_read', 'created_at')
    search_fields = ('title', 'content', 'receiver', 'sender', 'biz_no')
    readonly_fields = ('created_at',)
